require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let createdRecurringId;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = res.body.token;
});

afterAll(async () => {
  if (createdRecurringId) {
    // Delete generated sessions first (FK constraint)
    await supabase.from('schedules').delete().eq('recurring_id', createdRecurringId);
    await supabase.from('recurring_schedules').delete().eq('id', createdRecurringId);
  }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

const validRecurring = {
  days_of_week: [2, 5], // Tuesday and Friday
  time: '17:00',
  duration_minutes: 60,
  location: 'Court B',
  age_category: 'U13',
  fee: 20,
  start_date: '2026-12-01',
  end_date: '2026-12-31',
};

describe('POST /api/recurring', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/recurring').send(validRecurring);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set(auth())
      .send({ time: '17:00' });
    expect(res.status).toBe(400);
  });

  it('creates a recurring template and generates sessions', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set(auth())
      .send(validRecurring);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('recurring_schedule');
    expect(res.body).toHaveProperty('sessions_created');
    expect(res.body.sessions_created).toBeGreaterThan(0);
    createdRecurringId = res.body.recurring_schedule.id;
  });

  it('generates the correct number of sessions for Dec 2026 Tue+Fri', async () => {
    // Dec 2026: Tuesdays are 1,8,15,22,29 and Fridays are 4,11,18,25 = 9 sessions
    const res = await request(app)
      .post('/api/recurring')
      .set(auth())
      .send(validRecurring);
    expect(res.body.sessions_created).toBe(9);
    // clean up this extra one
    await supabase.from('schedules').delete().eq('recurring_id', res.body.recurring_schedule.id);
    await supabase.from('recurring_schedules').delete().eq('id', res.body.recurring_schedule.id);
  });
});

describe('GET /api/recurring', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/recurring').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/recurring/:id/cancel-future', () => {
  it('cancels future sessions and returns count', async () => {
    const res = await request(app)
      .post(`/api/recurring/${createdRecurringId}/cancel-future`)
      .set(auth())
      .send({ reason: 'Hall closed' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cancelled_sessions');
    expect(res.body.cancelled_sessions).toBeGreaterThan(0);
  });
});
