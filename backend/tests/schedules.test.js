require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let createdScheduleId;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = res.body.token;
});

afterAll(async () => {
  if (createdScheduleId) {
    await supabase.from('schedules').delete().eq('id', createdScheduleId);
  }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

const validSchedule = {
  date: '2026-12-01',
  time: '16:00',
  duration_minutes: 90,
  location: 'Court A',
  age_category: 'U15',
  fee: 20,
};

describe('POST /api/schedules', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/schedules').send(validSchedule);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .set(auth())
      .send({ date: '2026-12-01' });
    expect(res.status).toBe(400);
  });

  it('creates a schedule', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .set(auth())
      .send(validSchedule);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('scheduled');
    createdScheduleId = res.body.id;
  });
});

describe('GET /api/schedules', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/schedules').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/schedules/:id', () => {
  it('returns the schedule', async () => {
    const res = await request(app).get(`/api/schedules/${createdScheduleId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdScheduleId);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/schedules/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/schedules/:id', () => {
  it('updates the schedule', async () => {
    const res = await request(app)
      .put(`/api/schedules/${createdScheduleId}`)
      .set(auth())
      .send({ ...validSchedule, location: 'Court B' });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe('Court B');
  });
});

describe('POST /api/schedules/:id/cancel', () => {
  it('cancels the schedule', async () => {
    const res = await request(app)
      .post(`/api/schedules/${createdScheduleId}/cancel`)
      .set(auth())
      .send({ reason: 'Coach sick' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancellation_reason).toBe('Coach sick');
  });
});

describe('GET /api/schedules/:id/attendance', () => {
  it('returns schedule and students array', async () => {
    const res = await request(app)
      .get(`/api/schedules/${createdScheduleId}/attendance`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('schedule');
    expect(res.body).toHaveProperty('students');
    expect(Array.isArray(res.body.students)).toBe(true);
  });
});
