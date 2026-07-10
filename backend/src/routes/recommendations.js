const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const logger = require('../utils/logger');

// Helper to resolve user or guest ID
const getUserOrGuestId = async (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = await client.get(`session:${token}`);
        if (userId) return userId;
    }
    return `guest:${req.headers['x-guest-session-id'] || 'guest_default'}`;
};

// 1. Personalized Product Feed
router.get('/personalized', async (req, res, next) => {
    try {
        const ownerId = await getUserOrGuestId(req);

        // Fetch user's top categories from affinity (Sorted Set)
        const topCategories = await client.zRange(`user_affinity:${ownerId}`, 0, 2, { REV: true });
        
        // Fetch user's recently viewed history (List)
        const recentlyViewedIds = await client.lRange(`user_history:${ownerId}`, 0, 4);

        // Fetch global trending products
        const globalTrendingIds = await client.zRange('trending:global:24h', 0, 19, { REV: true });
        
        // Fallback: if no trending data exists, fetch some products
        let baseProductIds = [...globalTrendingIds];
        if (baseProductIds.length === 0) {
            const keys = await client.keys('product:*');
            baseProductIds = keys.map(k => k.replace(/^product:/, 'product:')).slice(0, 20);
        }

        // Score each base product
        const scoredProducts = [];
        for (const prodId of baseProductIds) {
            // Exclude already recently viewed products from recommendation for diversity
            if (recentlyViewedIds.includes(prodId)) continue;

            const product = await client.json.get(prodId);
            if (!product) continue;

            let score = 10; // Base score

            // Category Affinity boost
            if (topCategories.includes(product.categoryId)) {
                score += 50; // High boost for preferred categories
            }

            // Co-purchase affinity boost: check if this product was co-purchased with user's last viewed items
            if (recentlyViewedIds.length > 0) {
                const lastViewed = recentlyViewedIds[0];
                const copurchaseScore = await client.zScore(`copurchase:${lastViewed}`, prodId);
                if (copurchaseScore) {
                    score += parseInt(copurchaseScore) * 15;
                }
            }

            scoredProducts.push({
                product,
                score
            });
        }

        // Sort by score desc
        scoredProducts.sort((a, b) => b.score - a.score);

        res.json(scoredProducts.map(sp => sp.product).slice(0, 10));
    } catch (err) {
        next(err);
    }
});

// 2. Similar Products (Co-purchase Matrix: "Customers also bought")
router.get('/similar/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        
        // Fetch top 5 co-purchased products from Sorted Set
        const coPurchasedIds = await client.zRange(`copurchase:${productId}`, 0, 4, { REV: true });
        
        let similarProducts = [];
        for (const id of coPurchasedIds) {
            const product = await client.json.get(id);
            if (product) similarProducts.push(product);
        }

        // Fallback: if co-purchase data is sparse, find products in same category
        if (similarProducts.length < 3) {
            const targetProd = await client.json.get(productId);
            if (targetProd) {
                const catProductIds = await client.zRange(`category_products:${targetProd.categoryId}`, 0, 9);
                for (const catProdId of catProductIds) {
                    if (catProdId !== productId && !coPurchasedIds.includes(catProdId)) {
                        const product = await client.json.get(catProdId);
                        if (product) {
                            similarProducts.push(product);
                            if (similarProducts.length >= 5) break;
                        }
                    }
                }
            }
        }

        res.json(similarProducts.slice(0, 4));
    } catch (err) {
        next(err);
    }
});

// 3. Recently Viewed Products History
router.get('/recently-viewed', async (req, res, next) => {
    try {
        const ownerId = await getUserOrGuestId(req);
        const productIds = await client.lRange(`user_history:${ownerId}`, 0, 19);

        const history = [];
        for (const id of productIds) {
            const product = await client.json.get(id);
            if (product) history.push(product);
        }
        res.json(history);
    } catch (err) {
        next(err);
    }
});

// 4. Trending For You (Trending products in preferred categories)
router.get('/trending-for-you', async (req, res, next) => {
    try {
        const ownerId = await getUserOrGuestId(req);

        // Fetch top categories of user
        const topCategories = await client.zRange(`user_affinity:${ownerId}`, 0, 1, { REV: true });

        let results = [];

        if (topCategories.length > 0) {
            for (const catId of topCategories) {
                const trendingCatKey = `trending:category:${catId}:24h`;
                const productIds = await client.zRange(trendingCatKey, 0, 4, { REV: true });
                for (const id of productIds) {
                    const product = await client.json.get(id);
                    if (product) results.push(product);
                }
            }
        }

        // Fallback or padding with global trending
        if (results.length < 5) {
            const globalTrendingIds = await client.zRange('trending:global:24h', 0, 9, { REV: true });
            for (const id of globalTrendingIds) {
                if (!results.some(p => p.id === id)) {
                    const product = await client.json.get(id);
                    if (product) results.push(product);
                }
                if (results.length >= 8) break;
            }
        }

        res.json(results.slice(0, 6));
    } catch (err) {
        next(err);
    }
});

// 5. Interaction Tracking Event
router.post('/events', async (req, res, next) => {
    try {
        const { eventType, productId } = req.body;
        if (!productId || !eventType) {
            return res.status(400).json({ error: 'productId and eventType are required', status: 400 });
        }

        const product = await client.json.get(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found', status: 404 });
        }

        const ownerId = await getUserOrGuestId(req);

        // 1. Add to Recently Viewed List (Capped at 50)
        const historyKey = `user_history:${ownerId}`;
        await client.lPush(historyKey, productId);
        await client.lTrim(historyKey, 0, 49);
        await client.expire(historyKey, 604800); // 7 days

        // 2. Increment Category Affinity Sorted Set
        let weight = 1;
        if (eventType === 'add-to-cart') weight = 3;
        else if (eventType === 'purchase') weight = 5;

        const affinityKey = `user_affinity:${ownerId}`;
        await client.zIncrBy(affinityKey, weight, product.categoryId);
        await client.expire(affinityKey, 604800);

        logger.info('Interaction event processed', { ownerId, productId, eventType, weight });

        res.json({ message: 'Interaction event tracked successfully', ownerId, productId, eventType });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
