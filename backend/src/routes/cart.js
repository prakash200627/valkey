const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const logger = require('../utils/logger');

const getCartOwnerId = async (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = await client.get(`session:${token}`);
        if (userId) return userId;
    }
    
    const guestToken = req.headers['x-guest-session-id'] || 'guest_default';
    return `guest:${guestToken}`;
};

// 1. Get Current Cart
router.get('/', async (req, res, next) => {
    try {
        const ownerId = await getCartOwnerId(req);
        const cartKey = `cart:${ownerId}`;
        const cartItems = await client.hGetAll(cartKey);

        let items = [];
        let subtotal = 0;

        for (const [productId, qtyStr] of Object.entries(cartItems)) {
            const quantity = parseInt(qtyStr);
            const product = await client.json.get(productId);
            
            if (product) {
                const itemSubtotal = product.price.amount * quantity;
                subtotal += itemSubtotal;
                items.push({
                    product: {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        brand: product.brand,
                        images: product.images,
                        categoryId: product.categoryId
                    },
                    quantity,
                    subtotal: itemSubtotal
                });
            } else {
                await client.hDel(cartKey, productId);
            }
        }

        const couponCode = await client.get(`cart_coupon:${ownerId}`);
        let discount = 0;
        let couponDetails = null;

        if (couponCode) {
            const coupon = await client.json.get(`coupon:${couponCode}`);
            if (coupon && coupon.active) {
                discount = Math.min(
                    coupon.maxDiscount || 999999,
                    coupon.type === 'percentage' 
                        ? Math.round(subtotal * (coupon.value / 100))
                        : (coupon.value || 0)
                );
                couponDetails = {
                    code: coupon.code,
                    value: coupon.value,
                    type: coupon.type,
                    discount
                };
            }
        }

        res.json({
            ownerId,
            items,
            subtotal,
            discount,
            coupon: couponDetails,
            total: subtotal - discount
        });
    } catch (err) {
        next(err);
    }
});

// 2. Add Item to Cart
router.post('/items', async (req, res, next) => {
    try {
        const { productId, quantity = 1 } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'productId is required', status: 400 });
        }

        const ownerId = await getCartOwnerId(req);
        const cartKey = `cart:${ownerId}`;

        const product = await client.json.get(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product does not exist', status: 404 });
        }

        const currentQtyStr = await client.hGet(cartKey, productId);
        const currentQty = currentQtyStr ? parseInt(currentQtyStr) : 0;
        const newQty = currentQty + parseInt(quantity);

        await client.hSet(cartKey, productId, newQty);
        await client.expire(cartKey, 604800); // 7 days

        res.json({ message: 'Product added to cart!', productId, quantity: newQty });
    } catch (err) {
        next(err);
    }
});

// 3. Update Item Quantity
router.patch('/items/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity === undefined || isNaN(quantity)) {
            return res.status(400).json({ error: 'Valid quantity is required', status: 400 });
        }

        const ownerId = await getCartOwnerId(req);
        const cartKey = `cart:${ownerId}`;

        if (parseInt(quantity) <= 0) {
            await client.hDel(cartKey, productId);
            return res.json({ message: 'Item removed from cart.', productId, quantity: 0 });
        }

        await client.hSet(cartKey, productId, parseInt(quantity));
        await client.expire(cartKey, 604800);

        res.json({ message: 'Cart updated successfully!', productId, quantity: parseInt(quantity) });
    } catch (err) {
        next(err);
    }
});

// 4. Remove Item
router.delete('/items/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const ownerId = await getCartOwnerId(req);
        const cartKey = `cart:${ownerId}`;

        await client.hDel(cartKey, productId);
        res.json({ message: 'Product removed from cart.', productId });
    } catch (err) {
        next(err);
    }
});

// 5. Clear Cart
router.delete('/', async (req, res, next) => {
    try {
        const ownerId = await getCartOwnerId(req);
        const cartKey = `cart:${ownerId}`;
        const couponKey = `cart_coupon:${ownerId}`;

        await client.del(cartKey);
        await client.del(couponKey);

        res.json({ message: 'Cart cleared successfully!' });
    } catch (err) {
        next(err);
    }
});

// 6. Apply Coupon
router.post('/coupon', async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Coupon code is required', status: 400 });
        }

        const ownerId = await getCartOwnerId(req);
        const couponKey = `coupon:${code.toUpperCase()}`;

        const coupon = await client.json.get(couponKey);
        if (!coupon || !coupon.active) {
            return res.status(404).json({ error: 'Invalid or inactive coupon code', status: 404 });
        }

        const now = new Date();
        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
            return res.status(400).json({ error: 'This coupon is not active yet', status: 400 });
        }
        if (coupon.validUntil && new Date(coupon.validUntil) < now) {
            return res.status(400).json({ error: 'This coupon has expired', status: 400 });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ error: 'This coupon usage limit has been reached', status: 400 });
        }

        if (ownerId.startsWith('user:')) {
            const hasUsed = await client.sIsMember(`coupon_used:${coupon.code}`, ownerId);
            if (hasUsed) {
                return res.status(400).json({ error: 'You have already used this coupon', status: 400 });
            }
        }

        const cartKey = `cart:${ownerId}`;
        const cartItems = await client.hGetAll(cartKey);
        let subtotal = 0;

        for (const [productId, qtyStr] of Object.entries(cartItems)) {
            const product = await client.json.get(productId);
            if (product) {
                subtotal += product.price.amount * parseInt(qtyStr);
            }
        }

        if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
            return res.status(400).json({
                error: `Minimum order value of Rs. ${(coupon.minOrderAmount).toFixed(2)} is required to use this coupon`,
                status: 400
            });
        }

        await client.set(`cart_coupon:${ownerId}`, coupon.code, { EX: 604800 });

        res.json({
            message: 'Coupon applied successfully!',
            code: coupon.code,
            type: coupon.type,
            value: coupon.value
        });
    } catch (err) {
        next(err);
    }
});

// 7. Remove Coupon
router.delete('/coupon', async (req, res, next) => {
    try {
        const ownerId = await getCartOwnerId(req);
        await client.del(`cart_coupon:${ownerId}`);
        res.json({ message: 'Coupon removed from cart.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
