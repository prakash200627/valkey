const { createClient } = require('redis');
const logger = require('./logger');

const client = createClient({
    url: process.env.VALKEY_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            logger.warn(`Valkey connection lost. Attempting reconnection (retry #${retries})...`);
            const delay = Math.min(retries * 500, 3000);
            return delay;
        }
    }
});

client.on('error', (err) => logger.error('Valkey Client Error', { error: err.message }));
client.on('connect', () => logger.info('Valkey Client connecting...'));
client.on('ready', () => {
    logger.info('Valkey Client ready and connected');
    ensureIndexes().catch((err) => logger.error('Failed to run index checks after connection ready', { error: err.message }));
});

const connectDB = async () => {
    if (!client.isOpen) {
        logger.info('Attempting to connect to Valkey...', { url: process.env.VALKEY_URL || 'redis://localhost:6379' });
        await client.connect();
    }
};

const ensureIndexes = async () => {
    if (!client.isOpen) {
        logger.warn('Valkey client is not open. Skipping index verification.');
        return;
    }
    try {
        await client.ft.info('idx:products');
        logger.info('RediSearch index "idx:products" verified successfully');
    } catch (err) {
        const errMsg = err.message || '';
        if (
            errMsg.includes('Unknown Index') || 
            errMsg.toLowerCase().includes('no such index') || 
            errMsg.includes('not found') ||
            errMsg.includes('reading \'1\'') ||
            errMsg.includes('undefined')
        ) {
            logger.info('RediSearch index "idx:products" not found. Creating it dynamically...');
            try {
                await client.sendCommand([
                    'FT.CREATE', 'idx:products',
                    'ON', 'JSON',
                    'PREFIX', '1', 'product:',
                    'SCHEMA',
                    '$.name', 'AS', 'name', 'TEXT',
                    '$.description', 'AS', 'description', 'TEXT',
                    '$.brand', 'AS', 'brand', 'TAG',
                    '$.categoryId', 'AS', 'categoryId', 'TAG',
                    '$.price.amount', 'AS', 'price', 'NUMERIC',
                    '$.ratings.average', 'AS', 'rating', 'NUMERIC',
                    '$.embedding', 'AS', 'vec', 'VECTOR', 'HNSW', '6',
                        'TYPE', 'FLOAT32',
                        'DIM', '4',
                        'DISTANCE_METRIC', 'COSINE'
                ]);
                logger.info('RediSearch index "idx:products" created successfully.');
            } catch (createErr) {
                logger.error('Failed to create RediSearch index "idx:products"', { error: createErr.message });
            }
        } else {
            logger.error('Error during index verification check', { error: err.message });
        }
    }
};

module.exports = { client, connectDB, ensureIndexes };
