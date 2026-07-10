const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const validate = require('../middlewares/validate');
const { trendingEventSchema } = require('../schemas/trending');

const setTrendingTTL = async (keys) => {
    for (const key of keys) {
        if (key.endsWith(':1h')) await client.expire(key, 3600);
        else if (key.endsWith(':24h')) await client.expire(key, 86400);
    }
};

router.post('/events', validate(trendingEventSchema), async (req, res, next) => {
    try {
        const { eventType, productId } = req.body;
        const product = await client.json.get(productId);
        if (!product) return res.status(404).json({ error: 'Product not found', status: 404 });

        let weight = 1;
        if (eventType === 'add-to-cart') weight = 3;
        else if (eventType === 'purchase') weight = 5;

        const global1hKey = 'trending:global:1h', global24hKey = 'trending:global:24h';
        const cat1hKey = `trending:category:${product.categoryId}:1h`, cat24hKey = `trending:category:${product.categoryId}:24h`;

        await client.zIncrBy(global1hKey, weight, productId);
        await client.zIncrBy(global24hKey, weight, productId);
        await client.zIncrBy(cat1hKey, weight, productId);
        await client.zIncrBy(cat24hKey, weight, productId);

        await setTrendingTTL([global1hKey, global24hKey, cat1hKey, cat24hKey]);

        // Resolve user key for history and affinity
        const authHeader = req.headers.authorization;
        let ownerId = `guest:${req.headers['x-guest-session-id'] || 'guest_default'}`;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const userId = await client.get(`session:${token}`);
            if (userId) ownerId = userId;
        }

        // 1. Add to Recently Viewed List (Capped at 50)
        const historyKey = `user_history:${ownerId}`;
        await client.lPush(historyKey, productId);
        await client.lTrim(historyKey, 0, 49);
        await client.expire(historyKey, 604800);

        // 2. Add to Category Affinity Sorted Set
        const affinityKey = `user_affinity:${ownerId}`;
        await client.zIncrBy(affinityKey, weight, product.categoryId);
        await client.expire(affinityKey, 604800);

        res.json({ message: 'Event recorded successfully!', productId, eventType, weight });
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const { categoryId, window = '24h', limit = 10 } = req.query;
        let sortedSetKey = window === '1h' ? (categoryId ? `trending:category:${categoryId}:1h` : 'trending:global:1h') : (categoryId ? `trending:category:${categoryId}:24h` : 'trending:global:24h');
        const trendingIdsWithScores = await client.zRangeWithScores(sortedSetKey, 0, parseInt(limit) - 1, { REV: true });
        let trendingProducts = [];
        for (const item of trendingIdsWithScores) {
            const product = await client.json.get(item.value);
            if (product) trendingProducts.push({ ...product, trendingScore: item.score });
        }
        if (trendingProducts.length === 0) {
            const keys = await client.keys('product:*');
            for (const key of keys.slice(0, parseInt(limit))) {
                const product = await client.json.get(key);
                if (product) trendingProducts.push({ ...product, trendingScore: 0 });
            }
        }
        res.json({ window, categoryId: categoryId || 'global', count: trendingProducts.length, results: trendingProducts });
    } catch (err) { next(err); }
});

module.exports = router;
