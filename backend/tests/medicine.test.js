const request = require('supertest');
const app = require('../app');

describe('Medicine API', () => {
  let token;

  beforeAll(async () => {
    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pharmacy.com', password: 'password123' });
    token = res.body.token;
  });

  test('GET /api/medicines - should get all medicines', async () => {
    const res = await request(app).get('/api/medicines');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });

  test('POST /api/medicines - should create medicine', async () => {
    const res = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Medicine', price: 100, stock: 50, category: 'Tablets' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', 'New Medicine');
  });
});