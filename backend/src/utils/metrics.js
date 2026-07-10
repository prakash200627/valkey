const client = require('prom-client');
const { client: valkeyClient } = require('./db');

// Enable default metrics collection (CPU, memory, heap size, etc.)
client.collectDefaultMetrics();

// Define HTTP request metrics
const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10]
});

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'code']
});

// Define Valkey connectivity metric
const valkeyConnectedGauge = new client.Gauge({
    name: 'valkey_connected',
    help: 'Valkey database connectivity status (1 = connected, 0 = disconnected)'
});

// Update Valkey gauge periodically
setInterval(() => {
    valkeyConnectedGauge.set(valkeyClient.isOpen ? 1 : 0);
}, 5000);

// Request tracking middleware
const metricsMiddleware = (req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationInSeconds = diff[0] + diff[1] / 1e9;
        
        // Use path or route path if available to avoid cardinal explosion from IDs
        const route = req.route ? req.route.path : req.path;
        
        httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
        httpRequestDurationSeconds.labels(req.method, route, res.statusCode).observe(durationInSeconds);
    });
    next();
};

module.exports = {
    register: client.register,
    metricsMiddleware
};
