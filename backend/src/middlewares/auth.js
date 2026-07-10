const { client } = require('../utils/db');
const logger = require('../utils/logger');

const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'unauthorized', message: 'No session token provided', status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const sessionKey = `session:${token}`;

        const userId = await client.get(sessionKey);
        if (!userId) {
            return res.status(401).json({ error: 'unauthorized', message: 'Session expired or invalid', status: 401 });
        }

        const user = await client.json.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'not_found', message: 'User profile not found', status: 404 });
        }

        // Slide session TTL (24h)
        await client.expire(sessionKey, 86400);

        // Update concurrent session activity
        const now = Math.floor(Date.now() / 1000);
        const expiry = now + 86400;
        const userSessionsKey = `user_sessions:${userId}`;
        await client.zAdd(userSessionsKey, { score: expiry, value: token });
        await client.expire(userSessionsKey, 86400);
        await client.zRemRangeByScore(userSessionsKey, '-inf', now);

        req.token = token;
        req.user = user; // contains id, email, firstName, lastName, role, addresses, preferences, etc.
        next();
    } catch (err) {
        logger.error('requireAuth Middleware Error', { error: err.message });
        next(err);
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden', message: 'Admin access required', status: 403 });
    }
    next();
};

module.exports = { requireAuth, requireAdmin };
