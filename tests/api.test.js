const request = require('supertest');
const app = require('../server');

describe('Smart Contract Editor API', () => {
    test('Health check endpoint', async () => {
        const response = await request(app)
            .get('/api/health')
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    test('Policies endpoint', async () => {
        const response = await request(app)
            .get('/api/policies')
            .expect(200);

        expect(response.body.success).toBe(true);
    });
});
