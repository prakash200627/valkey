const express = require('express');
const router = express.Router();
const { v7: uuidv7 } = require('uuid');
const { client } = require('../utils/db');
const logger = require('../utils/logger');
const validate = require('../middlewares/validate');
const { productSchema } = require('../schemas/products');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

// 1. Get Single Product by ID
router.get('/:id', async (req, res, next) => {
    try {
        const product = await client.json.get(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found', status: 404 });
        }
        res.json(product);
    } catch (err) {
        next(err);
    }
});

// 2. Faceted Search
router.get('/', async (req, res, next) => {
    try {
        const { q, categoryId, minPrice, maxPrice, brand, sort, page = 1, limit = 20 } = req.query;
        let queryParts = [];
        
        if (q && q.trim()) {
            const cleanQuery = q.trim().replace(/[^a-zA-Z0-9 ]/g, '');
            if (cleanQuery) {
                // name and description are TEXT fields (wildcard prefix/suffix search), brand is TAG
                queryParts.push(`(@name:*${cleanQuery}* | @description:*${cleanQuery}* | @brand:{${cleanQuery}})`);
            }
        }

        if (categoryId) {
            const escapedCategory = categoryId.replace(/:/g, '\\:').replace(/-/g, '\\-');
            queryParts.push(`@categoryId:{${escapedCategory}}`);
        }

        if (minPrice || maxPrice) {
            const min = minPrice ? parseInt(minPrice) : 0;
            const max = maxPrice ? parseInt(maxPrice) : '+inf';
            queryParts.push(`@price:[${min} ${max}]`);
        }

        if (brand) {
            const escapedBrand = brand.trim().replace(/:/g, '\\:').replace(/-/g, '\\-').replace(/\s/g, '\\ ');
            queryParts.push(`@brand:{${escapedBrand}}`);
        }

        const baseQuery = queryParts.length > 0 ? queryParts.join(' ') : '*';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        logger.info('Executing RediSearch Query', { query: baseQuery });

        const searchOptions = {
            LIMIT: {
                from: offset,
                size: parseInt(limit)
            },
            DIALECT: 2
        };

        if (sort === 'price_asc') {
            searchOptions.SORTBY = { BY: 'price', DIRECTION: 'ASC' };
        } else if (sort === 'price_desc') {
            searchOptions.SORTBY = { BY: 'price', DIRECTION: 'DESC' };
        } else if (sort === 'rating_desc') {
            searchOptions.SORTBY = { BY: 'rating', DIRECTION: 'DESC' };
        }

        const searchResult = await client.ft.search('idx:products', baseQuery, searchOptions);

        res.json({
            query: q || '',
            total: searchResult.total,
            page: parseInt(page),
            pageSize: parseInt(limit),
            results: searchResult.documents.map(doc => doc.value)
        });
    } catch (err) {
        next(err);
    }
});

// 3. Create Product
router.post('/', requireAuth, requireAdmin, validate(productSchema), async (req, res, next) => {
    try {
        const { sku, name, description, shortDescription, categoryId, vendorId, brand, price, images, attributes, tags, inventory } = req.body;
        
        const productId = `product:${uuidv7()}`;
        const newProduct = {
            id: productId,
            sku: sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-'),
            description: description || '',
            shortDescription: shortDescription || '',
            categoryId,
            vendorId,
            brand: brand || 'Generic',
            price: {
                amount: price.amount,
                currency: price.currency || 'INR',
                compareAt: price.compareAt || price.amount
            },
            images: images || [{ url: '/assets/products/default.jpg', alt: name, isPrimary: true }],
            attributes: attributes || {},
            tags: tags || [],
            inventory: {
                quantity: inventory?.quantity || 100,
                reserved: 0,
                warehouse: inventory?.warehouse || 'HYD-WH-01'
            },
            ratings: { average: 5.0, count: 0 },
            embedding: req.body.embedding || [0.0, 0.0, 0.0, 0.0],
            status: 'active',
            createdAt: new Date().toISOString()
        };

        await client.json.set(productId, '$', newProduct);
        const timestamp = Date.now();
        await client.zAdd(`category_products:${categoryId}`, { score: timestamp, value: productId });
        await client.sAdd(`brand_products:${newProduct.brand}`, productId);
        await client.zAdd('price_index', { score: price.amount * 100, value: productId });

        logger.info('Product Created', { productId, name });

        res.status(201).json({
            message: 'Product created successfully!',
            productId,
            product: newProduct
        });
    } catch (err) {
        next(err);
    }
});

// 4. Update Product
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const productId = req.params.id;
        const existingProduct = await client.json.get(productId);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found', status: 404 });
        }

        if (req.body.name !== undefined) await client.json.set(productId, '$.name', req.body.name);
        if (req.body.description !== undefined) await client.json.set(productId, '$.description', req.body.description);
        if (req.body.shortDescription !== undefined) await client.json.set(productId, '$.shortDescription', req.body.shortDescription);
        if (req.body.brand !== undefined) {
            await client.json.set(productId, '$.brand', req.body.brand);
            await client.sRem(`brand_products:${existingProduct.brand}`, productId);
            await client.sAdd(`brand_products:${req.body.brand}`, productId);
        }
        if (req.body.categoryId !== undefined) {
            await client.json.set(productId, '$.categoryId', req.body.categoryId);
            await client.zRem(`category_products:${existingProduct.categoryId}`, productId);
            const timestamp = new Date(existingProduct.createdAt).getTime();
            await client.zAdd(`category_products:${req.body.categoryId}`, { score: timestamp, value: productId });
        }
        if (req.body.price !== undefined) {
            const updatedPrice = { ...existingProduct.price, ...req.body.price };
            await client.json.set(productId, '$.price', updatedPrice);
            if (req.body.price.amount !== undefined) {
                await client.zAdd('price_index', { score: req.body.price.amount * 100, value: productId });
            }
        }
        if (req.body.inventory !== undefined) {
            const updatedInventory = { ...existingProduct.inventory, ...req.body.inventory };
            await client.json.set(productId, '$.inventory', updatedInventory);
        }

        const updatedProduct = await client.json.get(productId);
        logger.info('Product Updated', { productId });

        res.json({
            message: 'Product updated successfully!',
            product: updatedProduct
        });
    } catch (err) {
        next(err);
    }
});

// 5. Get Similar Products (Vector Similarity)
router.get('/:id/similar', async (req, res, next) => {
    try {
        const product = await client.json.get(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found', status: 404 });
        }

        const embedding = product.embedding || [0.1, 0.2, 0.3, 0.4];
        const vecBuffer = Buffer.from(new Float32Array(embedding).buffer);

        // Find 5 nearest neighbors
        const searchResult = await client.ft.search('idx:products', `*=>[KNN 5 @vec $query_vec AS score]`, {
            PARAMS: {
                query_vec: vecBuffer
            },
            DIALECT: 2,
            SORTBY: {
                BY: 'score',
                DIRECTION: 'ASC'
            }
        });

        // Filter out current product and return
        const similar = searchResult.documents
            .map(doc => doc.value)
            .filter(p => p.id !== product.id)
            .slice(0, 4);

        res.json(similar);
    } catch (err) {
        next(err);
    }
});

// 6. Delete Product (Admin Only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const productId = req.params.id;
        const product = await client.json.get(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found', status: 404 });
        }

        // Clean up price index, category products, and brand products
        await client.zRem(`category_products:${product.categoryId}`, productId).catch(() => {});
        await client.sRem(`brand_products:${product.brand}`, productId).catch(() => {});
        await client.zRem('price_index', productId).catch(() => {});

        // Delete primary key
        await client.del(productId);

        logger.info('Product Deleted', { productId });

        res.json({ message: 'Product deleted successfully!', productId });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
