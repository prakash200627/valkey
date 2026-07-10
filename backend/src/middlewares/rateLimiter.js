const { client } = require('../utils/db');
const logger = require('../utils/logger');

// Define rate limits: { endpoint_prefix: { anonymousLimit, authenticatedLimit, windowSeconds } }
const rateLimitConfig = {
    '/api/auth/login': { anonymous: 5, authenticated: 5, window: 900 },
    '/api/checkout/start': { anonymous: 0, authenticated: 5, window: 60 },
    '/api/search': { anonymous: 20, authenticated: 60, window: 60 },
    '/api/products': { anonymous: 30, authenticated: 100, window: 60 },
    '/api/cart': { anonymous: 10, authenticated: 30, window: 60 }
};

const rateLimiter = async (req, res, next) => {
    try {
        const path = req.path;
        
        // Find matching configuration prefix
        let config = null;
        let matchedPrefix = '';
        for (const [prefix, rules] of Object.entries(rateLimitConfig)) {
            if (path.startsWith(prefix)) {
                config = rules;
                matchedPrefix = prefix;
                break;
            }
        }

        // If no rate limit configured for this route, skip checks
        if (!config) return next();

        // Determine identity
        const authHeader = req.headers.authorization;
        let userId = null;
        let isAuthenticated = false;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            userId = await client.get(`session:${token}`);
            if (userId) isAuthenticated = true;
        }

        const identityKey = isAuthenticated ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
        const limit = isAuthenticated ? config.authenticated : config.anonymous;

        // If anonymous limit is 0 (like starting checkout), reject immediately
        if (limit === 0) {
            return res.status(429).json({
                error: 'rate_limit_exceeded',
                message: 'Anonymous checkouts are disabled. Please log in or create an account to check out.',
                status: 429
            });
        }

        const nowUnix = Math.floor(Date.now() / 1000);
        // Use a fixed window key bucket: e.g. ratelimit:user:userId:/api/search:1716372600
        const windowTimestamp = Math.floor(nowUnix / config.window) * config.window;
        const rateLimitKey = `ratelimit:${identityKey}:${matchedPrefix}:${windowTimestamp}`;

        // Increment count
        const count = await client.incr(rateLimitKey);
        if (count === 1) {
            await client.expire(rateLimitKey, config.window);
        }

        const remaining = Math.max(0, limit - count);
        const resetTime = windowTimestamp + config.window;
        const retryAfter = Math.max(0, resetTime - nowUnix);

        // Set standard rate limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTime);

        if (count > limit) {
            logger.warn('Rate limit exceeded', { identity: identityKey, path, count, limit });
            res.setHeader('Retry-After', retryAfter);
            return res.status(429).json({
                error: 'rate_limit_exceeded',
                message: `Too many requests. Try again in ${retryAfter} seconds.`,
                status: 429
            });
        }

        next();
    } catch (err) {
        logger.error('Rate Limiter Middleware Error', { error: err.message });
        // Fail open: let requests pass if Valkey is down, to ensure high availability
        next();
    }
};

module.exports = rateLimiter;
