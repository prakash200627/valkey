const express = require('express');
const router = express.Router();
const { v7: uuidv7 } = require('uuid');
const { client } = require('../utils/db');
const logger = require('../utils/logger');

// Helper to get user or guest identifier
const getUserOrGuestId = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Just return a unique key representation. We don't necessarily block if token is invalid
        const token = authHeader.split(' ')[1];
        return `user:${token}`;
    }
    return `guest:${req.headers['x-guest-session-id'] || 'guest_default'}`;
};

// Helper to get current YYYY-MM-DD date string
const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

// 1. Get Contextual Ads
router.get('/', async (req, res, next) => {
    try {
        const { context, value } = req.query; // context = 'category' or 'keyword', value = categoryId or keyword string
        const today = getTodayDate();
        const userKey = getUserOrGuestId(req);

        let adKeys = [];

        if (context === 'category' && value) {
            // Get ads indexed for this category sorted by bid desc
            const adsZSetKey = `ads:category:${value}`;
            adKeys = await client.zRange(adsZSetKey, 0, -1, { REV: true });
        } else {
            // Default: get all ads (fallback scans)
            const keys = await client.keys('ad:*');
            adKeys = keys.filter(k => !k.includes('_spend') && !k.includes('_impressions') && !k.includes('_clicks'));
        }

        const eligibleAds = [];

        for (const adKey of adKeys) {
            const adId = adKey.startsWith('ad:') ? adKey : `ad:${adKey}`;
            const ad = await client.json.get(adId);
            if (!ad || ad.status !== 'active') continue;

            // 1. Check daily budget spend
            const spendKey = `ad_spend:${ad.id}:${today}`;
            const currentSpend = await client.get(spendKey);
            if (currentSpend && parseInt(currentSpend) >= ad.dailyBudget) {
                logger.info(`Ad ${ad.id} reached daily budget cap`, { currentSpend, budget: ad.dailyBudget });
                continue;
            }

            // 2. Check user frequency capping (max 3 impressions per user per day)
            const freqKey = `ad_freq:${userKey}:${ad.id}:${today}`;
            const views = await client.get(freqKey);
            if (views && parseInt(views) >= 3) {
                logger.info(`Ad ${ad.id} reached user frequency cap`, { userId: userKey, views });
                continue;
            }

            eligibleAds.push(ad);
        }

        // Return top eligible ads (already sorted by bid if fetched from ZSet)
        res.json(eligibleAds.slice(0, 3));
    } catch (err) {
        next(err);
    }
});

// 2. Create Ad
router.post('/', async (req, res, next) => {
    try {
        const { title, imageUrl, targetUrl, targetCategories, targetKeywords, bidAmount, dailyBudget } = req.body;

        if (!title || !imageUrl || !targetUrl || !bidAmount || !dailyBudget) {
            return res.status(400).json({ error: 'Missing required ad details', status: 400 });
        }

        const adId = `ad:${uuidv7()}`;
        const newAd = {
            id: adId,
            title,
            imageUrl,
            targetUrl,
            targetCategories: targetCategories || [],
            targetKeywords: targetKeywords || [],
            bidAmount: parseInt(bidAmount),
            dailyBudget: parseInt(dailyBudget),
            status: 'active',
            createdAt: new Date().toISOString()
        };

        await client.json.set(adId, '$', newAd);

        // Index in category ZSets for bidding
        for (const catId of newAd.targetCategories) {
            await client.zAdd(`ads:category:${catId}`, {
                score: newAd.bidAmount,
                value: adId
            });
        }

        res.status(201).json({
            message: 'Ad created successfully!',
            adId,
            ad: newAd
        });
    } catch (err) {
        next(err);
    }
});

// 3. Record Ad Impression
router.post('/:adId/impression', async (req, res, next) => {
    try {
        const { adId } = req.params;
        const today = getTodayDate();
        const userKey = getUserOrGuestId(req);

        const ad = await client.json.get(adId);
        if (!ad) {
            return res.status(404).json({ error: 'Ad not found', status: 404 });
        }

        const spendKey = `ad_spend:${adId}:${today}`;
        const impressionsKey = `ad_impressions:${adId}:${today}`;
        const freqKey = `ad_freq:${userKey}:${adId}:${today}`;

        // Atomically increment impression counter, daily spend, and user frequency cap
        await client.incr(impressionsKey);
        await client.expire(impressionsKey, 86400);

        await client.incrBy(spendKey, ad.bidAmount);
        await client.expire(spendKey, 86400);

        await client.incr(freqKey);
        await client.expire(freqKey, 86400);

        res.json({ message: 'Impression recorded successfully', adId });
    } catch (err) {
        next(err);
    }
});

// 4. Record Ad Click
router.post('/:adId/click', async (req, res, next) => {
    try {
        const { adId } = req.params;
        const today = getTodayDate();
        const clicksKey = `ad_clicks:${adId}:${today}`;

        await client.incr(clicksKey);
        await client.expire(clicksKey, 86400);

        res.json({ message: 'Click recorded successfully', adId });
    } catch (err) {
        next(err);
    }
});

// 5. Get Ad Analytics/Stats
router.get('/:adId/stats', async (req, res, next) => {
    try {
        const { adId } = req.params;
        const today = getTodayDate();

        const ad = await client.json.get(adId);
        if (!ad) {
            return res.status(404).json({ error: 'Ad not found', status: 404 });
        }

        const spend = parseInt(await client.get(`ad_spend:${adId}:${today}`) || '0');
        const impressions = parseInt(await client.get(`ad_impressions:${adId}:${today}`) || '0');
        const clicks = parseInt(await client.get(`ad_clicks:${adId}:${today}`) || '0');

        const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0.0;

        res.json({
            adId,
            title: ad.title,
            impressions,
            clicks,
            spend,
            ctrPercentage: ctr,
            dailyBudget: ad.dailyBudget,
            budgetRemaining: Math.max(0, ad.dailyBudget - spend)
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
