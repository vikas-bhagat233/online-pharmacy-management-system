const request = require('supertest');
const app = require('../app');

describe('Order API', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: 'password123' });
    token = res.body.token;
  });

  test('POST /api/orders - should create order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ medicineId: '1', quantity: 2 }], totalAmount: 40 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('totalAmount', 40);
  });

  test('GET /api/orders/my-orders - should get user orders', async () => {
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });
});