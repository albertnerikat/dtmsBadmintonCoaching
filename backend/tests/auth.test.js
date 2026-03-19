require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');

describe('POST /api/auth/login', () => {
  it('returns 401 with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@email.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns a token with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('returns 401 with missing body', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(401);
  });
});
