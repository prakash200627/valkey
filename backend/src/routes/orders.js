const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const { requireAuth } = require('../middlewares/auth');

// 1. Get Logged-In User Order History
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const orderIds = await client.zRange(`user_orders:${userId}`, 0, -1, { REV: true });
        
        const orders = [];
        for (const orderId of orderIds) {
            const order = await client.json.get(orderId);
            if (order) orders.push(order);
        }
        res.json(orders);
    } catch (err) {
        next(err);
    }
});

// 2. Get Single Order Details
router.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const order = await client.json.get(req.params.id);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found', status: 404 });
        }
        
        // Ensure user owns this order (or is admin)
        if (order.userId !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'forbidden', message: 'You do not have access to this order', status: 403 });
        }
        
        res.json(order);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
