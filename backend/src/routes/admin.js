const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const logger = require('../utils/logger');
const { v7: uuidv7 } = require('uuid');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

// Apply admin protection to all routes in this router
router.use(requireAuth);
router.use(requireAdmin);

// ==========================================
// 1. ORDER MANAGEMENT
// ==========================================

// Get all orders (sorted chronologically using UUIDv7 properties)
router.get('/orders', async (req, res, next) => {
    try {
        const keys = await client.keys('order:*');
        const orders = [];
        for (const key of keys) {
            const order = await client.json.get(key);
            if (order) orders.push(order);
        }
        
        // Sort orders by ID desc (UUIDv7 is chronological)
        orders.sort((a, b) => b.id.localeCompare(a.id));
        res.json(orders);
    } catch (err) {
        next(err);
    }
});

// Update order status
router.patch('/orders/:orderId', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'status is required', status: 400 });
        }

        const order = await client.json.get(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found', status: 404 });
        }

        order.status = status;
        order.updatedAt = new Date().toISOString();

        await client.json.set(orderId, '$', order);
        logger.info('Order status updated by admin', { orderId, status });

        res.json({ message: 'Order status updated successfully', order });
    } catch (err) {
        next(err);
    }
});

// ==========================================
// 2. CATEGORY CRUD
// ==========================================

// Create category
router.post('/categories', async (req, res, next) => {
    try {
        const { name, parentId, icon } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'name is required', status: 400 });
        }

        const catId = `category:${uuidv7()}`;
        const newCat = {
            id: catId,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-'),
            icon: icon || 'desktop',
            parentId: parentId || null,
            children: []
        };

        await client.json.set(catId, '$', newCat);

        // If parent category is supplied, append children list
        if (parentId) {
            const parent = await client.json.get(parentId);
            if (parent) {
                const kids = parent.children || [];
                kids.push(catId);
                await client.json.set(parentId, '$.children', kids);
            }
        }

        logger.info('Category created by admin', { catId, name });
        res.status(201).json({ message: 'Category created successfully!', category: newCat });
    } catch (err) {
        next(err);
    }
});

// Delete category
router.delete('/categories/:id', async (req, res, next) => {
    try {
        const catId = req.params.id;
        const cat = await client.json.get(catId);
        if (!cat) {
            return res.status(404).json({ error: 'Category not found', status: 404 });
        }

        // Remove association from parent
        if (cat.parentId) {
            const parent = await client.json.get(cat.parentId);
            if (parent) {
                const kids = (parent.children || []).filter(id => id !== catId);
                await client.json.set(cat.parentId, '$.children', kids);
            }
        }

        // Delete primary key
        await client.del(catId);
        // Clean up products relational sorted set
        await client.del(`category_products:${catId}`);

        logger.info('Category deleted by admin', { catId });
        res.json({ message: 'Category deleted successfully!', categoryId: catId });
    } catch (err) {
        next(err);
    }
});

// ==========================================
// 3. VENDOR CRUD
// ==========================================

// Create vendor
router.post('/vendors', async (req, res, next) => {
    try {
        const { name, email, phone, logo, address } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: 'name and email are required', status: 400 });
        }

        const vendorId = `vendor:${uuidv7()}`;
        const newVendor = {
            id: vendorId,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-'),
            email,
            phone: phone || '',
            logo: logo || '/assets/vendors/default.png',
            rating: 5.0,
            totalProducts: 0,
            totalSales: 0,
            address: address || {},
            verified: true,
            joinedAt: new Date().toISOString()
        };

        await client.json.set(vendorId, '$', newVendor);
        logger.info('Vendor created by admin', { vendorId, name });
        res.status(201).json({ message: 'Vendor registered successfully!', vendor: newVendor });
    } catch (err) {
        next(err);
    }
});

// Delete vendor
router.delete('/vendors/:id', async (req, res, next) => {
    try {
        const vendorId = req.params.id;
        const vendor = await client.json.get(vendorId);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found', status: 404 });
        }

        await client.del(vendorId);
        logger.info('Vendor deleted by admin', { vendorId });
        res.json({ message: 'Vendor deleted successfully!', vendorId });
    } catch (err) {
        next(err);
    }
});

// ==========================================
// 4. COUPON CRUD
// ==========================================

// Create coupon
router.post('/coupons', async (req, res, next) => {
    try {
        const { code, type, value, minOrderAmount, maxDiscount, validFrom, validUntil, usageLimit, applicableCategories } = req.body;
        
        if (!code || !type || !value) {
            return res.status(400).json({ error: 'code, type, and value are required', status: 400 });
        }

        const couponKey = `coupon:${code.toUpperCase()}`;
        const newCoupon = {
            code: code.toUpperCase(),
            type,
            value: parseFloat(value),
            minOrderAmount: parseFloat(minOrderAmount || 0),
            maxDiscount: parseFloat(maxDiscount || 999999),
            validFrom: validFrom || new Date().toISOString(),
            validUntil: validUntil || new Date(Date.now() + 365*24*3600*1000).toISOString(),
            usageLimit: parseInt(usageLimit || 1000),
            usedCount: 0,
            applicableCategories: applicableCategories || [],
            active: true
        };

        await client.json.set(couponKey, '$', newCoupon);
        logger.info('Coupon created by admin', { code: newCoupon.code });
        res.status(201).json({ message: 'Coupon created successfully!', coupon: newCoupon });
    } catch (err) {
        next(err);
    }
});

// Delete coupon
router.delete('/coupons/:code', async (req, res, next) => {
    try {
        const code = req.params.code.toUpperCase();
        const couponKey = `coupon:${code}`;
        const coupon = await client.json.get(couponKey);
        
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found', status: 404 });
        }

        await client.del(couponKey);
        await client.del(`coupon_used:${code}`); // clean up used set

        logger.info('Coupon deleted by admin', { code });
        res.json({ message: 'Coupon deleted successfully!', code });
    } catch (err) {
        next(err);
    }
});

// ==========================================
// 5. USER MANAGEMENT
// ==========================================

// List all users
router.get('/users', async (req, res, next) => {
    try {
        const keys = await client.keys('user:*');
        const users = [];
        for (const key of keys) {
            const user = await client.json.get(key);
            if (user) {
                delete user.passwordHash;
                users.push(user);
            }
        }
        res.json(users);
    } catch (err) {
        next(err);
    }
});

// Change user role
router.patch('/users/:userId/role', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (role !== 'admin' && role !== 'customer') {
            return res.status(400).json({ error: 'Role must be admin or customer', status: 400 });
        }

        const user = await client.json.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', status: 404 });
        }

        await client.json.set(userId, '$.role', role);
        logger.info('User role modified by admin', { targetUserId: userId, newRole: role });

        res.json({ message: 'User role updated successfully', userId, role });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
