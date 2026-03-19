require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let createdStudentId;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = res.body.token;
});

afterAll(async () => {
  if (createdStudentId) {
    await supabase.from('students').delete().eq('id', createdStudentId);
  }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

// DOB chosen so age is always clearly <=12 regardless of time of year:
// currentYear - 2014 = 12 (in 2026), and Jan 1 birthday has passed by any test run date.
const validStudent = {
  name: 'Test Student',
  date_of_birth: '2014-01-01',
  skill_level: 'Beginner',
  parent_name: 'Test Parent',
  parent_phone: '555-1234',
  parent_email: 'parent@test.com',
};

describe('POST /api/students', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/students').send(validStudent);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/students')
      .set(auth())
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  it('creates a student and returns with age_category and parent_access_token', async () => {
    const res = await request(app)
      .post('/api/students')
      .set(auth())
      .send(validStudent);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('age_category');
    expect(res.body).toHaveProperty('parent_access_token');
    expect(res.body.age_category).toBe('U13');
    createdStudentId = res.body.id;
  });
});

describe('GET /api/students', () => {
  it('returns array with age_category on each student', async () => {
    const res = await request(app).get('/api/students').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('age_category');
    }
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/students/:id', () => {
  it('updates the student', async () => {
    const res = await request(app)
      .put(`/api/students/${createdStudentId}`)
      .set(auth())
      .send({ ...validStudent, skill_level: 'Advanced' });
    expect(res.status).toBe(200);
    expect(res.body.skill_level).toBe('Advanced');
  });
});

describe('GET /api/students/:id', () => {
  it('returns a single student with age_category', async () => {
    const res = await request(app)
      .get(`/api/students/${createdStudentId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdStudentId);
    expect(res.body).toHaveProperty('age_category');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/students/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('POST /api/students/:id/regenerate-token', () => {
  it('returns a new parent_access_token different from the original', async () => {
    const original = await request(app)
      .get(`/api/students/${createdStudentId}`)
      .set(auth());
    const originalToken = original.body.parent_access_token;

    const res = await request(app)
      .post(`/api/students/${createdStudentId}/regenerate-token`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('parent_access_token');
    expect(res.body.parent_access_token).not.toBe(originalToken);
  });
});

describe('PATCH /api/students/:id/archive', () => {
  it('archives the student', async () => {
    const res = await request(app)
      .patch(`/api/students/${createdStudentId}/archive`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });
});
