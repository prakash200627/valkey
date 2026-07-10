const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4, v7: uuidv7 } = require('uuid');
const { client } = require('../utils/db');
const logger = require('../utils/logger');
const validate = require('../middlewares/validate');
const { registerSchema, loginSchema } = require('../schemas/auth');
const { requireAuth } = require('../middlewares/auth');

const createUserId = () => `user:${uuidv7()}`;

// 1. User Registration
router.post('/register', validate(registerSchema), async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;
        logger.info('Registration Attempt', { email, firstName, lastName });

        const emailLower = email.toLowerCase();
        const userExistsKey = `email_to_userid:${emailLower}`;

        const existingUserId = await client.get(userExistsKey);
        if (existingUserId) {
            logger.warn('Registration Failed: User already exists', { email: emailLower });
            return res.status(409).json({ error: 'User with this email already exists', status: 409 });
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const userId = createUserId();
        const newUser = {
            id: userId,
            email: emailLower,
            passwordHash,
            firstName,
            lastName,
            phone: phone || '',
            avatar: '/assets/avatars/default.jpg',
            role: 'customer',
            addresses: [],
            preferences: {
                currency: 'INR',
                language: 'en',
                notifications: true
            },
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        };

        await client.json.set(userId, '$', newUser);
        await client.set(userExistsKey, userId);
        
        logger.info('User Registered Successfully', { userId, email: emailLower });

        res.status(201).json({
            message: 'User registered successfully!',
            userId
        });
    } catch (err) {
        next(err);
    }
});

// 2. User Login
router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        logger.info('Login Attempt', { email });

        const emailLower = email.toLowerCase();
        const rateLimitKey = `login_attempts:${emailLower}`;

        const attempts = await client.get(rateLimitKey);
        if (attempts && parseInt(attempts) >= 5) {
            logger.warn('Login Failed: Too many attempts', { email: emailLower });
            return res.status(429).json({
                error: 'Too many failed login attempts. Please try again in 15 minutes.',
                status: 429
            });
        }

        const userExistsKey = `email_to_userid:${emailLower}`;
        const userId = await client.get(userExistsKey);
        if (!userId) {
            logger.warn('Login Failed: Invalid credentials (email not found)', { email: emailLower });
            await client.incr(rateLimitKey);
            await client.expire(rateLimitKey, 900);
            return res.status(401).json({ error: 'Invalid email or password', status: 401 });
        }

        const user = await client.json.get(userId);
        if (!user) {
            logger.error('Login Failed: User profile missing', { userId });
            return res.status(404).json({ error: 'User profile not found', status: 404 });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            logger.warn('Login Failed: Invalid credentials (password mismatch)', { email: emailLower });
            await client.incr(rateLimitKey);
            await client.expire(rateLimitKey, 900);
            return res.status(401).json({ error: 'Invalid email or password', status: 401 });
        }

        await client.del(rateLimitKey);

        const token = uuidv4();
        const sessionKey = `session:${token}`;
        await client.set(sessionKey, userId, { EX: 86400 });

        const now = Math.floor(Date.now() / 1000);
        const expiry = now + 86400;
        const userSessionsKey = `user_sessions:${userId}`;
        
        await client.zAdd(userSessionsKey, { score: expiry, value: token });
        await client.expire(userSessionsKey, 86400);
        await client.zRemRangeByScore(userSessionsKey, '-inf', now);

        const concurrentSessions = await client.zCard(userSessionsKey);
        await client.json.set(userId, '$.lastLoginAt', new Date().toISOString());

        // Merge guest cart on login
        const guestId = req.headers['x-guest-session-id'];
        if (guestId) {
            const guestCartKey = `cart:guest:${guestId}`;
            const userCartKey = `cart:${userId}`;
            try {
                const guestCartItems = await client.hGetAll(guestCartKey);
                if (guestCartItems && Object.keys(guestCartItems).length > 0) {
                    logger.info('Merging guest cart into user cart on login', { guestId, userId });
                    for (const [productId, qtyStr] of Object.entries(guestCartItems)) {
                        const quantity = parseInt(qtyStr);
                        const userQtyStr = await client.hGet(userCartKey, productId);
                        const userQty = userQtyStr ? parseInt(userQtyStr) : 0;
                        await client.hSet(userCartKey, productId, userQty + quantity);
                    }
                    await client.del(guestCartKey);
                    
                    const guestCouponKey = `cart_coupon:guest:${guestId}`;
                    const guestCouponCode = await client.get(guestCouponKey);
                    if (guestCouponCode) {
                        await client.set(`cart_coupon:${userId}`, guestCouponCode, { EX: 604800 });
                        await client.del(guestCouponKey);
                    }
                }
            } catch (mergeErr) {
                logger.error('Failed to merge guest cart on login', { error: mergeErr.message, guestId, userId });
            }
        }

        logger.info('Login Successful', { userId, concurrentSessions });

        res.json({
            message: 'Login successful!',
            token,
            concurrentSessions,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
});

// 3. Get Authenticated User
router.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No session token provided', status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const sessionKey = `session:${token}`;

        const userId = await client.get(sessionKey);
        if (!userId) {
            return res.status(401).json({ error: 'Session expired or invalid', status: 401 });
        }

        const user = await client.json.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', status: 404 });
        }

        await client.expire(sessionKey, 86400);

        const now = Math.floor(Date.now() / 1000);
        const expiry = now + 86400;
        const userSessionsKey = `user_sessions:${userId}`;
        await client.zAdd(userSessionsKey, { score: expiry, value: token });
        await client.expire(userSessionsKey, 86400);
        await client.zRemRangeByScore(userSessionsKey, '-inf', now);

        const concurrentSessions = await client.zCard(userSessionsKey);

        delete user.passwordHash;
        res.json({
            ...user,
            concurrentSessions
        });
    } catch (err) {
        next(err);
    }
});

// 4. Logout
router.post('/logout', requireAuth, async (req, res, next) => {
    try {
        const token = req.token;
        const userId = req.user.id;
        const sessionKey = `session:${token}`;

        await client.zRem(`user_sessions:${userId}`, token);
        await client.del(sessionKey);
        res.json({ message: 'Logged out successfully!' });
    } catch (err) {
        next(err);
    }
});

// 5. Session Refresh (sliding window)
router.post('/refresh', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userSessionsKey = `user_sessions:${userId}`;
        const concurrentSessions = await client.zCard(userSessionsKey);

        res.json({
            message: 'Session refreshed successfully!',
            concurrentSessions
        });
    } catch (err) {
        next(err);
    }
});

// 6. Profile Updates
router.patch('/profile', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, phone, preferences } = req.body;

        if (firstName !== undefined) await client.json.set(userId, '$.firstName', firstName);
        if (lastName !== undefined) await client.json.set(userId, '$.lastName', lastName);
        if (phone !== undefined) await client.json.set(userId, '$.phone', phone);
        if (preferences !== undefined) {
            const currentPrefs = req.user.preferences || {};
            await client.json.set(userId, '$.preferences', { ...currentPrefs, ...preferences });
        }

        const updatedUser = await client.json.get(userId);
        delete updatedUser.passwordHash;

        res.json({
            message: 'Profile updated successfully!',
            user: updatedUser
        });
    } catch (err) {
        next(err);
    }
});

// 7. Password Updates
router.patch('/password', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'oldPassword and newPassword are required', status: 400 });
        }

        const isMatch = await bcrypt.compare(oldPassword, req.user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect old password', status: 401 });
        }

        const salt = await bcrypt.genSalt(12);
        const newHash = await bcrypt.hash(newPassword, salt);

        await client.json.set(userId, '$.passwordHash', newHash);

        res.json({ message: 'Password updated successfully!' });
    } catch (err) {
        next(err);
    }
});

// 8. Add Shipping Address
router.post('/address', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { label, street, city, state, postalCode, country, lat, lng, isDefault } = req.body;

        if (!street || !city || !postalCode) {
            return res.status(400).json({ error: 'street, city, and postalCode are required', status: 400 });
        }

        const newAddress = {
            id: `addr:${uuidv7()}`,
            label: label || 'Home',
            street,
            city,
            state: state || '',
            postalCode,
            country: country || 'IN',
            lat: lat || 0.0,
            lng: lng || 0.0,
            isDefault: isDefault || false
        };

        let currentAddresses = req.user.addresses || [];

        if (newAddress.isDefault) {
            currentAddresses = currentAddresses.map(addr => ({ ...addr, isDefault: false }));
        } else if (currentAddresses.length === 0) {
            newAddress.isDefault = true;
        }

        currentAddresses.push(newAddress);
        await client.json.set(userId, '$.addresses', currentAddresses);

        res.status(201).json({
            message: 'Address added successfully!',
            address: newAddress,
            addresses: currentAddresses
        });
    } catch (err) {
        next(err);
    }
});

// 9. Delete Shipping Address
router.delete('/address/:addressId', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { addressId } = req.params;

        let currentAddresses = req.user.addresses || [];
        const index = currentAddresses.findIndex(addr => addr.id === addressId);
        if (index === -1) {
            return res.status(404).json({ error: 'Address not found', status: 404 });
        }

        const wasDefault = currentAddresses[index].isDefault;
        currentAddresses.splice(index, 1);

        if (wasDefault && currentAddresses.length > 0) {
            currentAddresses[0].isDefault = true;
        }

        await client.json.set(userId, '$.addresses', currentAddresses);

        res.json({
            message: 'Address deleted successfully!',
            addresses: currentAddresses
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
