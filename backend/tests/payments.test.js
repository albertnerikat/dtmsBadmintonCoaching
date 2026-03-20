require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let studentId;
let paymentId;
let scheduleId;
let attendanceId;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = loginRes.body.token;

  // Create test student
  const stuRes = await supabase.from('students').insert({
    name: 'Payment Test Student', date_of_birth: '2014-01-01',
    skill_level: 'Beginner', parent_name: 'Pay Parent',
    parent_phone: '555-1111', parent_email: 'pay@test.com',
  }).select().single();
  studentId = stuRes.data.id;

  // Create test schedule ($20 fee)
  const schedRes = await supabase.from('schedules').insert({
    date: '2026-03-01', time: '10:00', duration_minutes: 60,
    location: 'Court A', age_category: 'U13', fee: 20,
  }).select().single();
  scheduleId = schedRes.data.id;

  // Mark student as present
  const attRes = await supabase.from('attendance').insert({
    schedule_id: scheduleId, student_id: studentId,
    status: 'present', checked_in_at: new Date().toISOString(),
  }).select().single();
  attendanceId = attRes.data.id;
});

afterAll(async () => {
  if (paymentId) await supabase.from('payments').delete().eq('id', paymentId);
  if (attendanceId) await supabase.from('attendance').delete().eq('id', attendanceId);
  if (scheduleId) await supabase.from('schedules').delete().eq('id', scheduleId);
  if (studentId) await supabase.from('students').delete().eq('id', studentId);
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('POST /api/payments', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/payments')
      .send({ student_id: studentId, amount: 40, payment_date: '2026-03-15' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/payments').set(auth()).send({ amount: 40 });
    expect(res.status).toBe(400);
  });

  it('records a payment', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(auth())
      .send({ student_id: studentId, amount: 20, payment_date: '2026-03-15', notes: 'March' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(Number(res.body.amount)).toBe(20);
    paymentId = res.body.id;
  });
});

describe('GET /api/students/:id/ledger', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/students/${studentId}/ledger`);
    expect(res.status).toBe(401);
  });

  it('returns ledger structure with correct totals', async () => {
    const res = await request(app).get(`/api/students/${studentId}/ledger`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('student');
    expect(res.body).toHaveProperty('sessions');
    expect(res.body).toHaveProperty('payments');
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary.total_owed).toBe(20);  // 1 present × $20
    expect(res.body.summary.total_paid).toBe(20);  // $20 payment
    expect(res.body.summary.balance).toBe(0);
  });

  it('returns 404 for unknown student', async () => {
    const res = await request(app)
      .get('/api/students/00000000-0000-0000-0000-000000000000/ledger')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/payments/:id', () => {
  it('deletes the payment', async () => {
    const res = await request(app).delete(`/api/payments/${paymentId}`).set(auth());
    expect(res.status).toBe(204);
    paymentId = null;
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/payments/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
