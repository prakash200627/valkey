const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const logger = require('../utils/logger');

// Deterministic vector generator for DIM 4
function generateVector(text) {
    const vec = [0.1, 0.2, 0.3, 0.4];
    if (!text) return vec;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    for (let j = 0; j < 4; j++) {
        vec[j] = Math.sin(hash + j) * 0.5 + 0.5;
    }
    return vec;
}

// 1. Faceted & Full-Text Search
router.get('/', async (req, res, next) => {
    try {
        const { q, categoryId, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;
        let queryParts = [];

        if (q && q.trim()) {
            const cleanQuery = q.trim().replace(/[^a-zA-Z0-9 ]/g, '');
            if (cleanQuery) {
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

        const baseQuery = queryParts.length > 0 ? queryParts.join(' ') : '*';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Run search options
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

        // Fetch paginated results
        const searchResult = await client.ft.search('idx:products', baseQuery, searchOptions);

        // Fetch ALL matching products to compute facets
        const allMatchesResult = await client.ft.search('idx:products', baseQuery, {
            LIMIT: { from: 0, size: 10000 },
            DIALECT: 2
        });

        // Compute Facets
        const brandsMap = {};
        const categoriesMap = {};
        const priceRanges = {
            '0-5000': 0,
            '5000-15000': 0,
            '15000-50000': 0,
            '50000-100000': 0,
            '100000+': 0
        };

        const matchingProducts = allMatchesResult.documents.map(doc => doc.value);
        for (const prod of matchingProducts) {
            // Brand
            if (prod.brand) {
                brandsMap[prod.brand] = (brandsMap[prod.brand] || 0) + 1;
            }
            // Category
            if (prod.categoryId) {
                categoriesMap[prod.categoryId] = (categoriesMap[prod.categoryId] || 0) + 1;
            }
            // Price range
            const priceVal = prod.price?.amount || 0;
            if (priceVal < 500000) priceRanges['0-5000']++; // prices in paise
            else if (priceVal < 1500000) priceRanges['5000-15000']++;
            else if (priceVal < 5000000) priceRanges['15000-50000']++;
            else if (priceVal < 10000000) priceRanges['50000-100000']++;
            else priceRanges['100000+']++;
        }

        const brands = Object.entries(brandsMap).map(([name, count]) => ({ name, count }));
        const categories = Object.entries(categoriesMap).map(([id, count]) => ({ id, count }));
        const formattedPriceRanges = Object.entries(priceRanges).map(([range, count]) => ({ range, count }));

        res.json({
            query: q || '',
            total: searchResult.total,
            page: parseInt(page),
            pageSize: parseInt(limit),
            results: searchResult.documents.map(doc => doc.value),
            facets: {
                brands,
                categories,
                priceRanges: formattedPriceRanges
            }
        });
    } catch (err) {
        next(err);
    }
});

// 2. Autocomplete Suggestions
router.get('/suggest', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) return res.json([]);
        
        const prefix = q.trim().toLowerCase();
        try {
            // Attempt to use FT.SUGGET
            const suggestions = await client.sendCommand(['FT.SUGGET', 'autocomplete', prefix, 'FUZZY', 'MAX', '5']);
            if (suggestions && suggestions.length > 0) {
                return res.json(suggestions);
            }
        } catch (e) {
            // Dictionary not initialized, fall back to prefix match on names
        }

        // Fallback: search names starting with prefix
        const searchResult = await client.ft.search('idx:products', `@name:${prefix}*`, {
            LIMIT: { from: 0, size: 5 },
            DIALECT: 2
        });

        const suggestions = searchResult.documents.map(doc => doc.value.name);
        res.json(suggestions);
    } catch (err) {
        next(err);
    }
});

// 3. Semantic (Vector) Search
router.get('/semantic', async (req, res, next) => {
    try {
        const { q, limit = 10 } = req.query;
        if (!q || !q.trim()) {
            return res.status(400).json({ error: 'Query parameter q is required', status: 400 });
        }

        const vec = generateVector(q.trim());
        const vecBuffer = Buffer.from(new Float32Array(vec).buffer);

        // KNN search against @vec vector index field
        const searchResult = await client.ft.search('idx:products', `*=>[KNN ${parseInt(limit)} @vec $query_vec AS score]`, {
            PARAMS: {
                query_vec: vecBuffer
            },
            DIALECT: 2,
            SORTBY: {
                BY: 'score',
                DIRECTION: 'ASC'
            }
        });

        const results = searchResult.documents.map(doc => ({
            ...doc.value,
            similarityScore: parseFloat(doc.value.score || doc.score || 0)
        }));

        res.json(results);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
