# Schedule + Attendance Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement schedule management (one-off + recurring sessions, cancellation) and attendance check-in (mark students present or free for a session).

**Architecture:** Two new Supabase tables (`schedules`, `recurring_schedules`) plus an `attendance` join table. New Express route files for schedules, recurring, and attendance. `getAgeCategory` is extracted from `students.js` into a shared lib so attendance routes can reuse it. Two new React pages: a schedule list/creation page and a mobile-friendly check-in page.

**Tech Stack:** Same as Plan 1 — Node.js/Express, Supabase JS client, React 18, Tailwind CSS v4, React Router v6

---

## File Structure

### Backend
| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/lib/ageCategory.js` | Create | Shared `getAgeCategory(dateOfBirth)` function |
| `backend/src/routes/students.js` | Modify | Import `getAgeCategory` from lib instead of defining inline |
| `backend/src/routes/schedules.js` | Create | Schedule CRUD + cancellation + attendance listing |
| `backend/src/routes/recurring.js` | Create | Recurring template creation + session generation + cancel future |
| `backend/src/routes/attendance.js` | Create | Check-in, mark free, undo |
| `backend/src/app.js` | Modify | Register `/api/schedules`, `/api/recurring`, `/api/attendance` |
| `backend/tests/schedules.test.js` | Create | Schedule CRUD + cancel tests |
| `backend/tests/recurring.test.js` | Create | Recurring creation + cancel-future tests |
| `backend/tests/attendance.test.js` | Create | Check-in + free + undo tests |

### Frontend
| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/pages/SchedulesPage.jsx` | Create | List sessions + create one-off + create recurring + cancel |
| `frontend/src/pages/AttendancePage.jsx` | Create | Check-in view for a specific session |
| `frontend/src/components/schedules/ScheduleList.jsx` | Create | Table of sessions with status badges and actions |
| `frontend/src/components/schedules/ScheduleForm.jsx` | Create | One-off session creation form |
| `frontend/src/components/schedules/RecurringForm.jsx` | Create | Recurring series creation form |
| `frontend/src/components/attendance/CheckInView.jsx` | Create | Mobile-friendly student list with check-in/free/undo buttons |
| `frontend/src/App.jsx` | Modify | Add `/schedules` and `/attendance/:scheduleId` routes |
| `frontend/src/components/layout/Navbar.jsx` | Modify | Add Schedules nav link |

### Database
| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/002_schedules_attendance.sql` | Create | `recurring_schedules`, `schedules`, `attendance` tables |

---

## API Reference

```
GET    /api/schedules                          list sessions (query: status, age_category, date_from, date_to)
POST   /api/schedules                          create one-off session
GET    /api/schedules/:id                      get session
PUT    /api/schedules/:id                      update session (not if cancelled)
POST   /api/schedules/:id/cancel               cancel session (body: { reason })
GET    /api/schedules/:id/attendance           get schedule + all relevant students + their attendance status

GET    /api/recurring                          list recurring templates
POST   /api/recurring                          create template + generate sessions
POST   /api/recurring/:id/cancel-future        cancel all future scheduled sessions in series (body: { reason })

POST   /api/attendance/check-in                mark student present (body: { schedule_id, student_id })
POST   /api/attendance/free                    mark student free (body: { schedule_id, student_id, free_reason? })
PATCH  /api/attendance/:id/undo                reset attendance record to absent
```

---

## Tasks

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/002_schedules_attendance.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/002_schedules_attendance.sql`:

```sql
-- Recurring schedule templates
CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  days_of_week INTEGER[] NOT NULL,  -- JS getDay() values: 0=Sun, 1=Mon, ..., 6=Sat
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  location TEXT NOT NULL,
  age_category TEXT NOT NULL CHECK (age_category IN ('U13', 'U15', 'U17', 'Adults', 'Mixed')),
  fee DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual sessions (one-off OR generated from a recurring template)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  location TEXT NOT NULL,
  age_category TEXT NOT NULL CHECK (age_category IN ('U13', 'U15', 'U17', 'Adults', 'Mixed')),
  fee DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  cancellation_reason TEXT,
  recurring_id UUID REFERENCES recurring_schedules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Attendance records — one row per student per session
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'free')),
  free_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, student_id)
);
```

- [ ] **Step 2: Run migration in Supabase**

In Supabase dashboard → SQL Editor → paste and run the file contents.

Verify: Table Editor shows `recurring_schedules`, `schedules`, `attendance` tables.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_schedules_attendance.sql
git commit -m "feat: add schedules and attendance migration"
```

---

### Task 2: Backend — shared ageCategory lib + app.js + schedule routes + tests

**Files:**
- Create: `backend/src/lib/ageCategory.js`
- Modify: `backend/src/routes/students.js`
- Modify: `backend/src/app.js`
- Create: `backend/src/routes/schedules.js`
- Test: `backend/tests/schedules.test.js`

- [ ] **Step 1: Create `backend/src/lib/ageCategory.js`**

```javascript
function getAgeCategory(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  if (age <= 12) return 'U13';
  if (age <= 14) return 'U15';
  if (age <= 16) return 'U17';
  return 'Adults';
}

module.exports = { getAgeCategory };
```

- [ ] **Step 2: Update `backend/src/routes/students.js` to use the shared lib**

Replace the inline `getAgeCategory` function (lines 7–19) with an import:

```javascript
const { getAgeCategory } = require('../lib/ageCategory');
```

Delete the now-redundant inline function definition (the `function getAgeCategory(...) { ... }` block).

- [ ] **Step 3: Run existing student tests to confirm nothing broke**

```bash
cd backend
npm test -- tests/students.test.js
```
Expected: 10/10 passing (same as before)

- [ ] **Step 4: Write failing schedule tests**

Create `backend/tests/schedules.test.js`:

```javascript
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
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
npm test -- tests/schedules.test.js
```
Expected: FAIL (routes not yet registered)

- [ ] **Step 6: Update `backend/src/app.js` to register new routes**

Add after the existing route registrations:

```javascript
const scheduleRoutes = require('./routes/schedules');
const recurringRoutes = require('./routes/recurring');
const attendanceRoutes = require('./routes/attendance');

// Add these lines after app.use('/api/students', studentRoutes):
app.use('/api/schedules', scheduleRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/attendance', attendanceRoutes);
```

Also create empty placeholder files for routes not yet implemented:

`backend/src/routes/recurring.js`:
```javascript
const express = require('express');
const router = express.Router();
module.exports = router;
```

`backend/src/routes/attendance.js`:
```javascript
const express = require('express');
const router = express.Router();
module.exports = router;
```

- [ ] **Step 7: Create `backend/src/routes/schedules.js`**

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { getAgeCategory } = require('../lib/ageCategory');

const REQUIRED_FIELDS = ['date', 'time', 'duration_minutes', 'location', 'age_category'];
const VALID_CATEGORIES = ['U13', 'U15', 'U17', 'Adults', 'Mixed'];

router.use(authMiddleware);

// GET /api/schedules
router.get('/', async (req, res) => {
  const { status, age_category, date_from, date_to } = req.query;
  let query = supabase.from('schedules').select('*').order('date').order('time');
  if (status) query = query.eq('status', status);
  if (age_category) query = query.eq('age_category', age_category);
  if (date_from) query = query.gte('date', date_from);
  if (date_to) query = query.lte('date', date_to);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/schedules/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('schedules').select('*').eq('id', req.params.id).single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/schedules
router.post('/', async (req, res) => {
  const missing = REQUIRED_FIELDS.filter(f => !req.body[f]);
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  if (!VALID_CATEGORIES.includes(req.body.age_category)) {
    return res.status(400).json({ error: 'Invalid age_category' });
  }
  const { date, time, duration_minutes, location, age_category, fee = 20.00 } = req.body;
  const { data, error } = await supabase
    .from('schedules')
    .insert({ date, time, duration_minutes, location, age_category, fee })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/schedules/:id
router.put('/:id', async (req, res) => {
  const { date, time, duration_minutes, location, age_category, fee } = req.body;
  const { data, error } = await supabase
    .from('schedules')
    .update({ date, time, duration_minutes, location, age_category, fee })
    .eq('id', req.params.id)
    .neq('status', 'cancelled')
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found or cancelled' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/schedules/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  const { reason } = req.body;
  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'cancelled', cancellation_reason: reason || null })
    .eq('id', req.params.id)
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/schedules/:id/attendance
// Returns { schedule, students: [{ ...student, age_category, attendance: record | null }] }
router.get('/:id/attendance', async (req, res) => {
  const { data: schedule, error: schedErr } = await supabase
    .from('schedules').select('*').eq('id', req.params.id).single();
  if (schedErr?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found' });
  if (schedErr) return res.status(500).json({ error: schedErr.message });

  const { data: students, error: stuErr } = await supabase
    .from('students').select('*').eq('status', 'active').order('name');
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  const { data: records, error: attErr } = await supabase
    .from('attendance').select('*').eq('schedule_id', req.params.id);
  if (attErr) return res.status(500).json({ error: attErr.message });

  const relevant = students
    .map(s => ({ ...s, age_category: getAgeCategory(s.date_of_birth) }))
    .filter(s => schedule.age_category === 'Mixed' || s.age_category === schedule.age_category);

  res.json({
    schedule,
    students: relevant.map(s => ({
      ...s,
      attendance: records.find(r => r.student_id === s.id) || null,
    })),
  });
});

module.exports = router;
```

- [ ] **Step 8: Run schedule tests**

```bash
npm test -- tests/schedules.test.js
```
Expected: PASS (all tests green)

- [ ] **Step 9: Commit**

```bash
# Run from project root
git add backend/src/ backend/tests/schedules.test.js
git commit -m "feat: add schedule CRUD routes and shared ageCategory lib"
```

---

### Task 3: Backend — recurring schedule routes + tests

**Files:**
- Create: `backend/src/routes/recurring.js` (replace placeholder)
- Test: `backend/tests/recurring.test.js`

- [ ] **Step 1: Write failing recurring tests**

Create `backend/tests/recurring.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
npm test -- tests/recurring.test.js
```
Expected: FAIL (placeholder router returns nothing)

- [ ] **Step 3: Create `backend/src/routes/recurring.js`** (replace placeholder)

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

const REQUIRED_FIELDS = ['days_of_week', 'time', 'duration_minutes', 'location', 'age_category', 'start_date'];
const VALID_CATEGORIES = ['U13', 'U15', 'U17', 'Adults', 'Mixed'];

function generateSessionDates(daysOfWeek, startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = endDate
    ? new Date(endDate)
    : (() => { const d = new Date(startDate); d.setFullYear(d.getFullYear() + 1); return d; })();

  const current = new Date(start);
  while (current <= end) {
    if (daysOfWeek.includes(current.getDay())) {
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

router.use(authMiddleware);

// GET /api/recurring
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('recurring_schedules').select('*').order('start_date');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/recurring — create template + generate sessions
router.post('/', async (req, res) => {
  const missing = REQUIRED_FIELDS.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  if (!VALID_CATEGORIES.includes(req.body.age_category)) {
    return res.status(400).json({ error: 'Invalid age_category' });
  }
  if (!Array.isArray(req.body.days_of_week) || req.body.days_of_week.length === 0) {
    return res.status(400).json({ error: 'days_of_week must be a non-empty array' });
  }

  const { days_of_week, time, duration_minutes, location, age_category, fee = 20.00, start_date, end_date } = req.body;

  const { data: template, error: templateErr } = await supabase
    .from('recurring_schedules')
    .insert({ days_of_week, time, duration_minutes, location, age_category, fee, start_date, end_date })
    .select().single();
  if (templateErr) return res.status(500).json({ error: templateErr.message });

  const sessionDates = generateSessionDates(days_of_week, start_date, end_date);
  if (sessionDates.length > 0) {
    const sessions = sessionDates.map(date => ({
      date, time, duration_minutes, location, age_category, fee, recurring_id: template.id,
    }));
    const { error: sessErr } = await supabase.from('schedules').insert(sessions);
    if (sessErr) return res.status(500).json({ error: sessErr.message });
  }

  res.status(201).json({ recurring_schedule: template, sessions_created: sessionDates.length });
});

// POST /api/recurring/:id/cancel-future
router.post('/:id/cancel-future', async (req, res) => {
  const { reason } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'cancelled', cancellation_reason: reason || null })
    .eq('recurring_id', req.params.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('recurring_schedules').update({ status: 'cancelled' }).eq('id', req.params.id);

  res.json({ cancelled_sessions: data.length });
});

module.exports = router;
```

- [ ] **Step 4: Run recurring tests**

```bash
npm test -- tests/recurring.test.js
```
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
# Run from project root
git add backend/src/routes/recurring.js backend/tests/recurring.test.js
git commit -m "feat: add recurring schedule routes with session generation"
```

---

### Task 4: Backend — attendance routes + tests

**Files:**
- Create: `backend/src/routes/attendance.js` (replace placeholder)
- Test: `backend/tests/attendance.test.js`

- [ ] **Step 1: Write failing attendance tests**

Create `backend/tests/attendance.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
npm test -- tests/attendance.test.js
```
Expected: FAIL (placeholder router returns nothing)

- [ ] **Step 3: Create `backend/src/routes/attendance.js`** (replace placeholder)

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// POST /api/attendance/check-in
router.post('/check-in', async (req, res) => {
  const { schedule_id, student_id } = req.body;
  if (!schedule_id || !student_id) {
    return res.status(400).json({ error: 'schedule_id and student_id are required' });
  }
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      { schedule_id, student_id, status: 'present', checked_in_at: new Date().toISOString(), free_reason: null },
      { onConflict: 'schedule_id,student_id' }
    )
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/attendance/free
router.post('/free', async (req, res) => {
  const { schedule_id, student_id, free_reason } = req.body;
  if (!schedule_id || !student_id) {
    return res.status(400).json({ error: 'schedule_id and student_id are required' });
  }
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      { schedule_id, student_id, status: 'free', free_reason: free_reason || null, checked_in_at: new Date().toISOString() },
      { onConflict: 'schedule_id,student_id' }
    )
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/attendance/:id/undo
router.patch('/:id/undo', async (req, res) => {
  const { data, error } = await supabase
    .from('attendance')
    .update({ status: 'absent', checked_in_at: null, free_reason: null })
    .eq('id', req.params.id)
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Attendance record not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
```

- [ ] **Step 4: Run attendance tests**

```bash
npm test -- tests/attendance.test.js
```
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
# Run from project root
git add backend/src/routes/attendance.js backend/tests/attendance.test.js
git commit -m "feat: add attendance check-in and free session routes"
```

---

### Task 5: Frontend — App.jsx + Navbar + Schedules page

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Navbar.jsx`
- Create: `frontend/src/components/schedules/ScheduleList.jsx`
- Create: `frontend/src/components/schedules/ScheduleForm.jsx`
- Create: `frontend/src/pages/SchedulesPage.jsx`
- Create: `frontend/src/pages/AttendancePage.jsx` (placeholder for Task 7)

- [ ] **Step 1: Update `frontend/src/components/layout/Navbar.jsx`**

Add a Schedules link alongside the existing Students link:

```jsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">DTMS Badminton</span>
        <Link to="/students" className="text-sm hover:underline">Students</Link>
        <Link to="/schedules" className="text-sm hover:underline">Schedules</Link>
      </div>
      <button onClick={handleLogout} className="text-sm hover:underline">Logout</button>
    </nav>
  );
}
```

- [ ] **Step 2: Create placeholder `frontend/src/pages/AttendancePage.jsx`**

```jsx
export default function AttendancePage() {
  return <div className="text-gray-500">Attendance check-in — coming next</div>;
}
```

- [ ] **Step 3: Update `frontend/src/App.jsx` to add new routes**

Add imports and routes for `/schedules` and `/attendance/:scheduleId`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import StudentsPage from './pages/StudentsPage';
import SchedulesPage from './pages/SchedulesPage';
import AttendancePage from './pages/AttendancePage';

function CoachLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </>
  );
}

function ProtectedCoachPage({ children }) {
  return (
    <ProtectedRoute>
      <CoachLayout>{children}</CoachLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/students" element={<ProtectedCoachPage><StudentsPage /></ProtectedCoachPage>} />
          <Route path="/schedules" element={<ProtectedCoachPage><SchedulesPage /></ProtectedCoachPage>} />
          <Route path="/attendance/:scheduleId" element={<ProtectedCoachPage><AttendancePage /></ProtectedCoachPage>} />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/schedules/ScheduleForm.jsx`**

```jsx
import { useState } from 'react';

const AGE_CATEGORIES = ['U13', 'U15', 'U17', 'Adults', 'Mixed'];

export default function ScheduleForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    date:             initial.date             ?? '',
    time:             initial.time             ?? '',
    duration_minutes: initial.duration_minutes ?? 90,
    location:         initial.location         ?? '',
    age_category:     initial.age_category     ?? 'U13',
    fee:              initial.fee              ?? 20,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({ ...form, duration_minutes: Number(form.duration_minutes), fee: Number(form.fee) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (label, key, type = 'text', extraProps = {}) => (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        required
        {...extraProps}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {field('Date', 'date', 'date')}
      {field('Time', 'time', 'time')}
      {field('Duration (minutes)', 'duration_minutes', 'number', { min: 15, max: 300 })}
      {field('Location', 'location')}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Age Category</label>
        <select
          value={form.age_category}
          onChange={e => setForm(f => ({ ...f, age_category: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {AGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {field('Fee ($)', 'fee', 'number', { min: 0, step: '0.01' })}
      <div className="flex gap-2 mt-4">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/schedules/ScheduleList.jsx`**

```jsx
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  scheduled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-600',
};

const CATEGORY_COLORS = {
  U13: 'bg-green-100 text-green-800',
  U15: 'bg-blue-100 text-blue-800',
  U17: 'bg-purple-100 text-purple-800',
  Adults: 'bg-orange-100 text-orange-800',
  Mixed: 'bg-yellow-100 text-yellow-800',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleList({ schedules, onCancel }) {
  const navigate = useNavigate();

  if (schedules.length === 0) {
    return <p className="text-center text-gray-500 py-12">No sessions found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-3 py-2 border">Date</th>
            <th className="px-3 py-2 border">Time</th>
            <th className="px-3 py-2 border">Location</th>
            <th className="px-3 py-2 border">Category</th>
            <th className="px-3 py-2 border">Status</th>
            <th className="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map(s => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border font-medium">
                {s.date} <span className="text-gray-400 text-xs">({DAYS[new Date(s.date + 'T00:00:00').getDay()]})</span>
              </td>
              <td className="px-3 py-2 border">{s.time.slice(0, 5)}</td>
              <td className="px-3 py-2 border">{s.location}</td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[s.age_category]}`}>
                  {s.age_category}
                </span>
              </td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                  {s.status}
                </span>
                {s.cancellation_reason && (
                  <div className="text-gray-400 text-xs mt-0.5">{s.cancellation_reason}</div>
                )}
              </td>
              <td className="px-3 py-2 border">
                <div className="flex gap-3">
                  {s.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => navigate(`/attendance/${s.id}`)}
                        className="text-blue-600 hover:underline"
                      >
                        Check-in
                      </button>
                      <button
                        onClick={() => onCancel(s)}
                        className="text-red-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/pages/SchedulesPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import ScheduleList from '../components/schedules/ScheduleList';
import ScheduleForm from '../components/schedules/ScheduleForm';

const STATUS_FILTERS = ['All', 'scheduled', 'cancelled'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CancelModal({ schedule, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(schedule.id, reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-sm text-gray-600 mb-3">
        Cancel session on <strong>{schedule.date}</strong> at <strong>{schedule.time?.slice(0, 5)}</strong>?
      </p>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Reason (optional)</label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. Coach unavailable"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Cancelling...' : 'Cancel Session'}
        </button>
        <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Keep
        </button>
      </div>
    </form>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [statusFilter, setStatusFilter] = useState('scheduled');
  const [modal, setModal] = useState(null); // null | 'add' | { cancel: schedule }
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSchedules(); }, [statusFilter]);

  async function loadSchedules() {
    setLoading(true);
    try {
      const query = statusFilter === 'All' ? '/schedules' : `/schedules?status=${statusFilter}`;
      const data = await api.get(query);
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(form) {
    await api.post('/schedules', form);
    await loadSchedules();
    setModal(null);
  }

  async function handleCancel(id, reason) {
    await api.post(`/schedules/${id}/cancel`, { reason });
    await loadSchedules();
    setModal(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Schedules</h1>
        <button
          onClick={() => setModal('add')}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
        >
          + Add Session
        </button>
      </div>

      <div className="flex gap-1 mb-4">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded text-sm border capitalize ${
              statusFilter === f ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading schedules...</p>
      ) : (
        <ScheduleList
          schedules={schedules}
          onCancel={schedule => setModal({ cancel: schedule })}
        />
      )}

      {modal === 'add' && (
        <Modal title="Add Session" onClose={() => setModal(null)}>
          <ScheduleForm onSubmit={handleAdd} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.cancel && (
        <Modal title="Cancel Session" onClose={() => setModal(null)}>
          <CancelModal
            schedule={modal.cancel}
            onConfirm={handleCancel}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify the frontend builds**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/src/
git commit -m "feat: add schedules page with list, create, and cancel"
```

---

### Task 6: Frontend — Add recurring form to Schedules page

**Files:**
- Create: `frontend/src/components/schedules/RecurringForm.jsx`
- Modify: `frontend/src/pages/SchedulesPage.jsx`

- [ ] **Step 1: Create `frontend/src/components/schedules/RecurringForm.jsx`**

```jsx
import { useState } from 'react';

const AGE_CATEGORIES = ['U13', 'U15', 'U17', 'Adults', 'Mixed'];
const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export default function RecurringForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    days_of_week: [],
    time: '',
    duration_minutes: 90,
    location: '',
    age_category: 'U13',
    fee: 20,
    start_date: '',
    end_date: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleDay(value) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(value)
        ? f.days_of_week.filter(d => d !== value)
        : [...f.days_of_week, value].sort(),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.days_of_week.length === 0) {
      setError('Select at least one day of the week');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        duration_minutes: Number(form.duration_minutes),
        fee: Number(form.fee),
        end_date: form.end_date || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (label, key, type = 'text', extraProps = {}) => (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        required={key !== 'end_date'}
        {...extraProps}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="mb-3">
        <label className="block text-sm font-medium mb-2">Days of Week</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`px-3 py-1.5 rounded text-sm border ${
                form.days_of_week.includes(d.value)
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {field('Start Date', 'start_date', 'date')}
      {field('End Date (optional)', 'end_date', 'date')}
      {field('Time', 'time', 'time')}
      {field('Duration (minutes)', 'duration_minutes', 'number', { min: 15, max: 300 })}
      {field('Location', 'location')}

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Age Category</label>
        <select
          value={form.age_category}
          onChange={e => setForm(f => ({ ...f, age_category: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {AGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {field('Fee ($)', 'fee', 'number', { min: 0, step: '0.01' })}

      <div className="flex gap-2 mt-4">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Series'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Update `frontend/src/pages/SchedulesPage.jsx` to add recurring creation**

Add the import and a new modal state. In the existing file, make these changes:

At the top, add import:
```jsx
import RecurringForm from '../components/schedules/RecurringForm';
```

Update the "+ Add Session" button area — replace the single button with a split button group:
```jsx
<div className="flex gap-2">
  <button
    onClick={() => setModal('add')}
    className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
  >
    + One-off Session
  </button>
  <button
    onClick={() => setModal('recurring')}
    className="border border-blue-700 text-blue-700 px-4 py-2 rounded text-sm hover:bg-blue-50"
  >
    + Recurring Series
  </button>
</div>
```

Add `handleAddRecurring` function:
```jsx
async function handleAddRecurring(form) {
  const result = await api.post('/recurring', form);
  await loadSchedules();
  setModal(null);
  alert(`Created ${result.sessions_created} session(s) in the series.`);
}
```

Add recurring modal at the bottom (alongside the existing modals):
```jsx
{modal === 'recurring' && (
  <Modal title="Create Recurring Series" onClose={() => setModal(null)}>
    <RecurringForm onSubmit={handleAddRecurring} onCancel={() => setModal(null)} />
  </Modal>
)}
```

- [ ] **Step 3: Verify the frontend builds**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/
git commit -m "feat: add recurring schedule creation form"
```

---

### Task 7: Frontend — Attendance check-in page

**Files:**
- Create: `frontend/src/components/attendance/CheckInView.jsx`
- Modify: `frontend/src/pages/AttendancePage.jsx` (replace placeholder)

- [ ] **Step 1: Create `frontend/src/components/attendance/CheckInView.jsx`**

```jsx
import { useState } from 'react';
import { api } from '../../lib/api';

const STATUS_STYLES = {
  present: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', label: 'Present' },
  free:    { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', label: 'Free' },
  absent:  { bg: 'bg-white border-gray-200', badge: 'bg-gray-100 text-gray-600', label: 'Absent' },
};

function FreeReasonModal({ student, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onConfirm(reason); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold mb-3">Mark {student.name} as Free</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text" value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (e.g. sibling, sick, location)"
            className="w-full border rounded px-3 py-2 text-sm mb-4"
          />
          <div className="flex gap-2">
            <button
              type="submit" disabled={loading}
              className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Mark Free'}
            </button>
            <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CheckInView({ scheduleId, students: initialStudents }) {
  const [students, setStudents] = useState(initialStudents);
  const [freeModal, setFreeModal] = useState(null); // null | student object

  function updateStudentAttendance(studentId, attendance) {
    setStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, attendance } : s)
    );
  }

  async function handleCheckIn(student) {
    const data = await api.post('/attendance/check-in', {
      schedule_id: scheduleId,
      student_id: student.id,
    });
    updateStudentAttendance(student.id, data);
  }

  async function handleFree(student, reason) {
    const data = await api.post('/attendance/free', {
      schedule_id: scheduleId,
      student_id: student.id,
      free_reason: reason,
    });
    updateStudentAttendance(student.id, data);
    setFreeModal(null);
  }

  async function handleUndo(student) {
    const data = await api.patch(`/attendance/${student.attendance.id}/undo`);
    updateStudentAttendance(student.id, data);
  }

  const status = (student) => student.attendance?.status || 'absent';

  const presentCount = students.filter(s => status(s) === 'present').length;
  const freeCount = students.filter(s => status(s) === 'free').length;

  return (
    <div>
      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>Total: <strong>{students.length}</strong></span>
        <span className="text-green-700">Present: <strong>{presentCount}</strong></span>
        <span className="text-yellow-700">Free: <strong>{freeCount}</strong></span>
        <span className="text-gray-500">Absent: <strong>{students.length - presentCount - freeCount}</strong></span>
      </div>

      {students.length === 0 && (
        <p className="text-gray-500 text-center py-8">No students in this age category.</p>
      )}

      <div className="space-y-2">
        {students.map(student => {
          const st = status(student);
          const styles = STATUS_STYLES[st];
          return (
            <div
              key={student.id}
              className={`border rounded-lg p-3 flex items-center justify-between ${styles.bg}`}
            >
              <div>
                <div className="font-medium">{student.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}>
                    {styles.label}
                  </span>
                  {student.attendance?.free_reason && (
                    <span className="text-xs text-gray-500">({student.attendance.free_reason})</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {st !== 'present' && (
                  <button
                    onClick={() => handleCheckIn(student)}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
                  >
                    Check In
                  </button>
                )}
                {st !== 'free' && (
                  <button
                    onClick={() => setFreeModal(student)}
                    className="bg-yellow-500 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-600"
                  >
                    Free
                  </button>
                )}
                {st !== 'absent' && (
                  <button
                    onClick={() => handleUndo(student)}
                    className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {freeModal && (
        <FreeReasonModal
          student={freeModal}
          onConfirm={(reason) => handleFree(freeModal, reason)}
          onClose={() => setFreeModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `frontend/src/pages/AttendancePage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import CheckInView from '../components/attendance/CheckInView';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AttendancePage() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/schedules/${scheduleId}/attendance`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  const { schedule, students } = data;
  const dayName = DAYS[new Date(schedule.date + 'T00:00:00').getDay()];

  return (
    <div>
      <button onClick={() => navigate('/schedules')} className="text-blue-600 text-sm hover:underline mb-4 block">
        ← Back to Schedules
      </button>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h1 className="text-lg font-bold">{dayName}, {schedule.date}</h1>
        <div className="text-sm text-gray-600 mt-1">
          {schedule.time?.slice(0, 5)} · {schedule.duration_minutes} min · {schedule.location} · {schedule.age_category}
        </div>
        {schedule.status === 'cancelled' && (
          <div className="mt-2 text-red-600 text-sm font-medium">
            Cancelled: {schedule.cancellation_reason}
          </div>
        )}
      </div>

      {schedule.status === 'cancelled' ? (
        <p className="text-gray-500 text-center py-8">This session has been cancelled.</p>
      ) : (
        <CheckInView scheduleId={scheduleId} students={students} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the frontend builds**

```bash
cd frontend
npm run build
```
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/
git commit -m "feat: add attendance check-in page"
```

---

## What's Next

- **Plan 3:** Payments + Dashboard + Parent View
