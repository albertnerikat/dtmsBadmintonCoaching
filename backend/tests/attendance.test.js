require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let scheduleId;
let studentId;
let attendanceId;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = loginRes.body.token;

  // Create a test schedule
  const schedRes = await supabase.from('schedules').insert({
    date: '2026-12-15', time: '10:00', duration_minutes: 60,
    location: 'Test Court', age_category: 'U13', fee: 20,
  }).select().single();
  scheduleId = schedRes.data.id;

  // Create a test student (U13: born 2014-01-01)
  const stuRes = await supabase.from('students').insert({
    name: 'Attendance Test Student', date_of_birth: '2014-01-01',
    skill_level: 'Beginner', parent_name: 'Test Parent',
    parent_phone: '555-0000', parent_email: 'att@test.com',
  }).select().single();
  studentId = stuRes.data.id;
});

afterAll(async () => {
  if (attendanceId) await supabase.from('attendance').delete().eq('id', attendanceId);
  if (scheduleId) await supabase.from('schedules').delete().eq('id', scheduleId);
  if (studentId) await supabase.from('students').delete().eq('id', studentId);
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('POST /api/attendance/check-in', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/attendance/check-in').send({ schedule_id: scheduleId, student_id: studentId });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/attendance/check-in').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('checks in a student', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set(auth())
      .send({ schedule_id: scheduleId, student_id: studentId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('present');
    expect(res.body.checked_in_at).toBeTruthy();
    attendanceId = res.body.id;
  });

  it('calling check-in again returns the same record updated (upsert)', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set(auth())
      .send({ schedule_id: scheduleId, student_id: studentId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('present');
    expect(res.body.id).toBe(attendanceId);
  });
});

describe('POST /api/attendance/free', () => {
  it('marks a student as free with a reason', async () => {
    const res = await request(app)
      .post('/api/attendance/free')
      .set(auth())
      .send({ schedule_id: scheduleId, student_id: studentId, free_reason: 'sibling' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');
    expect(res.body.free_reason).toBe('sibling');
  });
});

describe('PATCH /api/attendance/:id/undo', () => {
  it('resets attendance to absent', async () => {
    const res = await request(app)
      .patch(`/api/attendance/${attendanceId}/undo`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('absent');
    expect(res.body.checked_in_at).toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/api/attendance/00000000-0000-0000-0000-000000000000/undo')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
