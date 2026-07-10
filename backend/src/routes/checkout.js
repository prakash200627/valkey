const express = require('express');
const router = express.Router();
const { v7: uuidv7 } = require('uuid');
const { client } = require('../utils/db');
const validate = require('../middlewares/validate');
const { checkoutStartSchema, checkoutConfirmSchema } = require('../schemas/checkout');

const getCartOwnerId = async (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = await client.get(`session:${token}`);
        if (userId) return userId;
    }
    return `guest:${req.headers['x-guest-session-id'] || 'guest_default'}`;
};

const RESERVE_INVENTORY_LUA = `
local keys = KEYS
local qtys = ARGV
for i = 1, #keys do
    local key = keys[i]
    local qty = tonumber(qtys[i])
    local q_data = redis.call('JSON.GET', key, '$.inventory.quantity')
    local r_data = redis.call('JSON.GET', key, '$.inventory.reserved')
    if not q_data then return -i end
    local q = tonumber(cjson.decode(q_data)[1]) or 0
    local r = tonumber(cjson.decode(r_data)[1]) or 0
    if (q - r) < qty then return -i end
end
for i = 1, #keys do
    local key = keys[i]
    local qty = tonumber(qtys[i])
    redis.call('JSON.NUMINCRBY', key, '$.inventory.reserved', qty)
end
return 1
`;

router.post('/start', validate(checkoutStartSchema), async (req, res, next) => {
    try {
        const ownerId = await getCartOwnerId(req);
        const cartKey = `cart:${ownerId}`;
        const cartItems = await client.hGetAll(cartKey);
        if (!cartItems || Object.keys(cartItems).length === 0) {
            return res.status(400).json({ error: 'Your shopping cart is empty', status: 400 });
        }

        const productKeys = [], productQuantities = [], items = [];
        let subtotal = 0;

        for (const [productId, qtyStr] of Object.entries(cartItems)) {
            const quantity = parseInt(qtyStr);
            const product = await client.json.get(productId);
            if (!product) { await client.hDel(cartKey, productId); continue; }
            productKeys.push(productId);
            productQuantities.push(String(quantity));
            subtotal += product.price.amount * quantity;
            items.push({ productId: product.id, sku: product.sku, name: product.name, brand: product.brand, quantity, price: product.price.amount, images: product.images, categoryId: product.categoryId });
        }

        if (items.length === 0) return res.status(400).json({ error: 'All items in your cart are no longer valid', status: 400 });

        const scriptResult = await client.eval(RESERVE_INVENTORY_LUA, { keys: productKeys, arguments: productQuantities });
        if (scriptResult < 0) {
            const failedProduct = items[Math.abs(scriptResult) - 1];
            const currentStock = await client.json.get(failedProduct.productId);
            const available = currentStock.inventory.quantity - (currentStock.inventory.reserved || 0);
            return res.status(400).json({ error: `Insufficient inventory for "${failedProduct.name}"`, available: Math.max(0, available), status: 400 });
        }

        const couponCode = await client.get(`cart_coupon:${ownerId}`);
        let discount = 0;
        if (couponCode) {
            const coupon = await client.json.get(`coupon:${couponCode}`);
            if (coupon && coupon.active) {
                discount = Math.min(coupon.maxDiscount || 999999, coupon.type === 'percentage' ? Math.round(subtotal * (coupon.value / 100)) : (coupon.value || 0));
            }
        }

        const orderId = `order:${uuidv7()}`;
        const tax = Math.round((subtotal - discount) * 0.18); // 18% GST in paise
        const shipping = (subtotal - discount) > 100000 ? 0 : 10000; // free shipping above Rs. 1000, otherwise Rs. 100 (in paise)
        const total = subtotal - discount + tax + shipping;

        const pendingOrder = { 
            id: orderId, 
            userId: ownerId, 
            status: 'pending', 
            items, 
            subtotal, 
            discount, 
            couponCode: couponCode || '', 
            tax,
            shipping,
            total, 
            shippingAddress: req.body.address || {}, 
            createdAt: new Date().toISOString() 
        };
        await client.json.set(orderId, '$', pendingOrder);
        await client.expire(orderId, 600);

        for (const item of items) { await client.set(`reservation:${orderId}:${item.productId}`, String(item.quantity), { EX: 600 }); }

        res.json({ message: 'Inventory reserved! Order prepared.', orderId, order: pendingOrder });
    } catch (err) { next(err); }
});

router.post('/confirm', validate(checkoutConfirmSchema), async (req, res, next) => {
    try {
        const { orderId, payment } = req.body;
        const order = await client.json.get(orderId);
        if (!order) return res.status(404).json({ error: 'Order has expired or does not exist', status: 404 });
        if (order.status !== 'pending') return res.status(400).json({ error: `Order status is "${order.status}". Cannot confirm.`, status: 400 });

        const multi = client.multi();
        for (const item of order.items) {
            multi.json.numIncrBy(item.productId, '$.inventory.quantity', -item.quantity);
            multi.json.numIncrBy(item.productId, '$.inventory.reserved', -item.quantity);
            multi.del(`reservation:${orderId}:${item.productId}`);
        }
        await multi.exec();

        order.status = 'confirmed';
        order.payment = { method: payment?.method || 'card', transactionId: payment?.transactionId || `txn_${Math.random().toString(36).substr(2, 9)}`, status: 'captured' };
        order.updatedAt = new Date().toISOString();

        await client.json.set(orderId, '$', order);
        await client.persist(orderId);
        await client.del(`cart:${order.userId}`);
        await client.del(`cart_coupon:${order.userId}`);

        if (order.userId.startsWith('user:')) {
            await client.zAdd(`user_orders:${order.userId}`, { score: Math.floor(Date.now() / 1000), value: orderId });
            if (order.couponCode) {
                const couponKey = `coupon:${order.couponCode.toUpperCase()}`;
                await client.json.numIncrBy(couponKey, '$.usedCount', 1).catch(() => {});
                await client.sAdd(`coupon_used:${order.couponCode.toUpperCase()}`, order.userId).catch(() => {});
            }
        }

        // Increment real-time business metrics
        try {
            const currentHour = Math.floor(new Date().setMinutes(0, 0, 0) / 1000);
            const revenueKey = `metrics:revenue:${currentHour}`;
            const ordersCountKey = `metrics:orders:count:${currentHour}`;

            await client.incrBy(revenueKey, order.total || 0);
            await client.expire(revenueKey, 604800); // 7 days TTL

            await client.incr(ordersCountKey);
            await client.expire(ordersCountKey, 604800);

            if (order.userId) {
                const todayStr = new Date().toISOString().split('T')[0];
                const hour = new Date().getHours();
                await client.pfAdd(`active_users:${todayStr}:${hour}`, order.userId);
                await client.expire(`active_users:${todayStr}:${hour}`, 86400);
            }
        } catch (metricsErr) {
            logger.error('Failed to update business analytics on checkout', { error: metricsErr.message });
        }

        for (const item of order.items) {
            await client.zIncrBy('trending:global:24h', 5, item.productId).catch(() => {});
            await client.zIncrBy(`trending:category:${item.categoryId}:24h`, 5, item.productId).catch(() => {});
        }

        // Update co-purchase matrix for "bought together" recommendations
        const orderItems = order.items || [];
        for (let i = 0; i < orderItems.length; i++) {
            for (let j = 0; j < orderItems.length; j++) {
                if (i !== j) {
                    await client.zIncrBy(`copurchase:${orderItems[i].productId}`, 1, orderItems[j].productId).catch(() => {});
                }
            }
        }

        res.json({ message: 'Order confirmed successfully!', orderId, order });
    } catch (err) { next(err); }
});

router.post('/cancel', async (req, res, next) => {
    try {
        const { orderId } = req.body;
        const order = await client.json.get(orderId);
        if (!order || order.status !== 'pending') return res.status(400).json({ error: 'Invalid or already processed order', status: 400 });
        const multi = client.multi();
        for (const item of order.items) { multi.json.numIncrBy(item.productId, '$.inventory.reserved', -item.quantity); multi.del(`reservation:${orderId}:${item.productId}`); }
        multi.del(orderId);
        await multi.exec();
        res.json({ message: 'Pending order cancelled.' });
    } catch (err) { next(err); }
});

router.get('/orders', async (req, res, next) => {
    try {
        const ownerId = await getCartOwnerId(req);
        if (!ownerId.startsWith('user:')) return res.status(401).json({ error: 'Must be logged in to view order history', status: 401 });
        const orderIds = await client.zRange(`user_orders:${ownerId}`, 0, -1, { REV: true });
        const orders = [];
        for (const orderId of orderIds) { const order = await client.json.get(orderId); if (order) orders.push(order); }
        res.json(orders);
    } catch (err) { next(err); }
});

module.exports = router;
