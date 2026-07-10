const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { register, metricsMiddleware } = require('./utils/metrics');
const rateLimiter = require('./middlewares/rateLimiter');

// Import routers (placeholders for now, will create them in src/routes)
const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const trendingRouter = require('./routes/trending');
const checkoutRouter = require('./routes/checkout');
const categoriesRouter = require('./routes/categories');
const vendorsRouter = require('./routes/vendors');
const ordersRouter = require('./routes/orders');
const searchRouter = require('./routes/search');
const adsRouter = require('./routes/ads');
const recommendationsRouter = require('./routes/recommendations');
const deliveryRouter = require('./routes/delivery');
const agentRouter = require('./routes/agent');
const adminRouter = require('./routes/admin');
const analyticsRouter = require('./routes/analytics');

const app = express();

// Register Prometheus Metrics middleware before other routes and logs
app.use(metricsMiddleware);

// 1. CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json());

// 2. Request Logging Middleware (Morgan + Winston)
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// 3. Health Check & Metrics Endpoints
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'valkey-backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/health/valkey', async (req, res) => {
    const { client } = require('./utils/db');
    try {
        if (!client.isOpen || !client.isReady) {
            throw new Error('Valkey client is not connected');
        }
        await client.ping();
        res.status(200).json({ status: 'ok', database: 'valkey' });
    } catch (err) {
        logger.error('Valkey health check failed', { error: err.message });
        res.status(503).json({ status: 'error', database: 'valkey', message: err.message });
    }
});

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        logger.error('Metrics retrieval failed', { error: err.message });
        res.status(500).end(err.message || 'Metrics error');
    }
});

// 4. Mount Routes
app.use('/api', rateLimiter);
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/trending', trendingRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/search', searchRouter);
app.use('/api/ads', adsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/agent', agentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);

// 5. Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Unhandled Error', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    const status = err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(status).json({
        error: (status === 500 && isProduction) ? 'Internal Server Error' : err.message || 'Internal Server Error',
        status: status
    });
});

module.exports = app;
