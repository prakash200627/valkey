const request = require('supertest');

// Mock redis client to prevent trying to connect to a real server during tests
jest.mock('redis', () => {
    return {
        createClient: jest.fn().mockReturnValue({
            connect: jest.fn().mockResolvedValue(true),
            ping: jest.fn().mockResolvedValue('PONG'),
            on: jest.fn(),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            isOpen: true,
            isReady: true
        })
    };
});

const app = require('../src/app');

describe('Valkey Backend Health Endpoints', () => {
    it('should return 200 and OK status for general health check', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('service', 'valkey-backend');
    });

    it('should return 200 and OK status for Valkey health check', async () => {
        const res = await request(app).get('/health/valkey');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('database', 'valkey');
    });
});
