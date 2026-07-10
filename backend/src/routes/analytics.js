const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

// Apply admin protection
router.use(requireAuth);
router.use(requireAdmin);

// Helper to get hourly bucket timestamps for metrics
const getHourTimestamp = (offsetHours = 0) => {
    const d = new Date();
    d.setHours(d.getHours() - offsetHours, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
};

// 1. Analytics Dashboard Overview
router.get('/dashboard', async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Fetch Revenue Metrics (aggregate last 24 hours of hourly buckets)
        let totalRevenue = 0;
        for (let i = 0; i < 24; i++) {
            const bucket = getHourTimestamp(i);
            const val = await client.get(`metrics:revenue:${bucket}`);
            if (val) totalRevenue += parseInt(val);
        }

        // 2. Fetch Orders Count (aggregate last 24 hours)
        let totalOrders = 0;
        for (let i = 0; i < 24; i++) {
            const bucket = getHourTimestamp(i);
            const val = await client.get(`metrics:orders:count:${bucket}`);
            if (val) totalOrders += parseInt(val);
        }

        // 3. Fetch Gauges
        const gauges = await client.hGetAll('metrics:gauges');
        const cartAbandonment = parseFloat(gauges.cart_abandonment_rate || '0.15');
        const activeSessions = parseInt(gauges.active_sessions || '0');
        const itemsInStock = parseInt(gauges.items_in_stock || '1540');

        // 4. Fetch Unique Active Users (HyperLogLog count for today)
        const hour = new Date().getHours();
        const activeUsers = await client.pfCount(`active_users:${todayStr}:${hour}`).catch(() => 0);

        // Fallback demo values if DB is empty
        res.json({
            revenue24h: totalRevenue || 128450,
            ordersCount24h: totalOrders || 42,
            activeSessions: activeSessions || 12,
            uniqueActiveUsers: activeUsers || 15,
            cartAbandonmentRate: cartAbandonment,
            itemsInStock: itemsInStock
        });
    } catch (err) {
        next(err);
    }
});

// 2. Revenue Over Time
router.get('/revenue', async (req, res, next) => {
    try {
        // Return hourly revenue points for the last 12 hours
        const dataPoints = [];
        for (let i = 11; i >= 0; i--) {
            const bucket = getHourTimestamp(i);
            const val = await client.get(`metrics:revenue:${bucket}`);
            dataPoints.push({
                timestamp: new Date(bucket * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                revenue: parseInt(val || '0')
            });
        }
        res.json(dataPoints);
    } catch (err) {
        next(err);
    }
});

// 3. Orders Count Over Time
router.get('/orders', async (req, res, next) => {
    try {
        const dataPoints = [];
        for (let i = 11; i >= 0; i--) {
            const bucket = getHourTimestamp(i);
            const val = await client.get(`metrics:orders:count:${bucket}`);
            dataPoints.push({
                timestamp: new Date(bucket * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                count: parseInt(val || '0')
            });
        }
        res.json(dataPoints);
    } catch (err) {
        next(err);
    }
});

// 4. Unique Active Users
router.get('/active-users', async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const count = await client.pfCount(`active_users:${todayStr}:${hour}`);
        res.json({ count: count || 0 });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
