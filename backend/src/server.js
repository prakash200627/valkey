require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./utils/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        
        const server = app.listen(PORT, () => {
            logger.info(`Server is listening on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
        });

        const shutdown = async (signal) => {
            logger.info(`${signal} received. Starting graceful shutdown...`);
            
            // Set up force shutdown timeout (10 seconds)
            const forceExitTimeout = setTimeout(() => {
                logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
            
            server.close(async () => {
                logger.info('HTTP server closed.');
                const { client } = require('./utils/db');
                if (client.isOpen) {
                    try {
                        await client.quit();
                        logger.info('Valkey connection closed gracefully.');
                    } catch (err) {
                        logger.error('Error closing Valkey connection gracefully', { error: err.message });
                    }
                }
                clearTimeout(forceExitTimeout);
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
        logger.error('Failed to start server', { error: err.message, stack: err.stack });
        process.exit(1);
    }
};

startServer();
