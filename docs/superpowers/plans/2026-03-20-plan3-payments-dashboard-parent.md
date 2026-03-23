# Payments, Dashboard & Parent View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cash payment recording and per-student ledgers, a coach dashboard showing upcoming sessions and outstanding balances, and a read-only parent view accessible via unique UUID link.

**Architecture:** A `payments` table stores cash payment records per student. A ledger endpoint computes billing (present attendance × session fee) vs. payments made. The parent view is a public Express route (no JWT required) that looks up a student by their `parent_access_token` and returns their attendance history and ledger. A dashboard endpoint pre-computes upcoming sessions and per-student balances in a single response.

**Tech Stack:** Same as Plans 1 & 2 — Node.js/Express 5, Supabase JS client, React 18, Tailwind CSS v4, React Router v6

---

## File Structure

### Backend
| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/003_payments.sql` | Create | `payments` table |
| `backend/src/routes/payments.js` | Create | POST/DELETE payment records, mounted at `/api/payments` |
| `backend/src/routes/ledger.js` | Create | GET student ledger (attendance + payments + totals), mounted at `/api/students` alongside existing studentRoutes |
| `backend/src/routes/dashboard.js` | Create | GET dashboard data (upcoming sessions + balances), mounted at `/api/dashboard` |
| `backend/src/routes/parent.js` | Create | GET parent view by token (no auth), mounted at `/api/parent` |
| `backend/src/app.js` | Modify (×2) | Register payments+ledger in Task 2, dashboard+parent in Task 3 |
| `backend/tests/payments.test.js` | Create | Payment CRUD + ledger tests |
| `backend/tests/dashboard.test.js` | Create | Dashboard + parent view tests |

### Frontend
| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/lib/api.js` | Modify | Add `api.delete` method |
| `frontend/src/App.jsx` | Modify | Add `/dashboard`, `/ledger/:studentId`, `/parent/:token` routes; default redirect → `/dashboard` |
| `frontend/src/components/layout/Navbar.jsx` | Modify | Add Dashboard nav link |
| `frontend/src/components/students/StudentList.jsx` | Modify | Add Ledger button per student row |
| `frontend/src/components/payments/PaymentForm.jsx` | Create | Form to record a cash payment (amount, date, notes) |
| `frontend/src/pages/LedgerPage.jsx` | Create | Per-student ledger: sessions + payments + summary + record payment |
| `frontend/src/pages/DashboardPage.jsx` | Create | Coach dashboard: upcoming sessions + outstanding balances |
| `frontend/src/pages/ParentPage.jsx` | Create | Public parent view: attendance history + payment summary (no auth) |

### Database
| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/003_payments.sql` | Create | `payments` table |

---

## API Reference

```
POST   /api/payments              record a cash payment { student_id, amount, payment_date, notes? }
DELETE /api/payments/:id          delete a payment

GET    /api/students/:id/ledger   attendance sessions + payments + computed totals

GET    /api/dashboard             upcoming sessions (14 days) + per-student balances

GET    /api/parent/:token         parent view (no auth) — student info + ledger by parent_access_token
```

### Ledger response shape
```json
{
  "student": { "id", "name", "date_of_birth", "skill_level", "status" },
  "sessions": [
    { "id", "status", "free_reason", "checked_in_at", "schedule": { "id", "date", "time", "location", "age_category", "fee" } }
  ],
  "payments": [{ "id", "amount", "payment_date", "notes", "created_at" }],
  "summary": {
    "total_sessions": 5,
    "present_sessions": 4,
    "free_sessions": 1,
    "total_owed": 80.00,
    "total_paid": 60.00,
    "balance": 20.00
  }
}
```

**Billing rule:** Only `present` sessions count toward `total_owed`. `free` sessions are $0 (the coach granted a free pass). `balance` = `total_owed` − `total_paid`. Positive balance = student owes money.

---

## Tasks

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/003_payments.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/003_payments.sql`:

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_student_id_idx ON payments(student_id);
```

- [ ] **Step 2: Run migration in Supabase**

In Supabase dashboard → SQL Editor → paste and run the file contents.

Verify: Table Editor shows `payments` table with columns: id, student_id, amount, payment_date, notes, created_at.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_payments.sql
git commit -m "feat: add payments migration"
```

---

### Task 2: Backend — payments routes + ledger route + tests

**Files:**
- Create: `backend/src/routes/payments.js`
- Create: `backend/src/routes/ledger.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/payments.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/payments.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
npm test -- tests/payments.test.js
```
Expected: FAIL (routes not yet registered)

- [ ] **Step 3: Create `backend/src/routes/payments.js`**

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// POST /api/payments
router.post('/', async (req, res) => {
  const { student_id, amount, payment_date, notes } = req.body;
  if (!student_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'student_id, amount, and payment_date are required' });
  }
  const { data, error } = await supabase
    .from('payments')
    .insert({ student_id, amount, payment_date, notes: notes || null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/payments/:id
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('id', req.params.id)
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Payment not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
```

- [ ] **Step 4: Create `backend/src/routes/ledger.js`**

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// GET /api/students/:id/ledger
// Note: This router is mounted at /api/students alongside studentRoutes.
// Express only matches /:id/ledger here — /:id alone is handled by studentRoutes.
router.get('/:id/ledger', async (req, res) => {
  // Verify student exists
  const { data: student, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level, status')
    .eq('id', req.params.id)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  // Get all non-absent attendance with schedule info
  // Supabase join: 'schedule:schedules(...)' creates a nested 'schedule' object on each attendance row
  const { data: attendance, error: attErr } = await supabase
    .from('attendance')
    .select('id, status, free_reason, checked_in_at, schedule:schedules(id, date, time, location, age_category, fee)')
    .eq('student_id', req.params.id)
    .neq('status', 'absent');
  if (attErr) return res.status(500).json({ error: attErr.message });

  // Get all payments, newest first
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', req.params.id)
    .order('payment_date', { ascending: false });
  if (payErr) return res.status(500).json({ error: payErr.message });

  // Sort sessions by date descending
  const sessions = (attendance || []).sort(
    (a, b) => new Date(b.schedule?.date) - new Date(a.schedule?.date)
  );

  // Only 'present' sessions are billed; 'free' sessions cost $0
  const total_owed = sessions
    .filter(s => s.status === 'present')
    .reduce((sum, s) => sum + Number(s.schedule?.fee || 0), 0);
  const total_paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    student,
    sessions,
    payments: payments || [],
    summary: {
      total_sessions: sessions.length,
      present_sessions: sessions.filter(s => s.status === 'present').length,
      free_sessions: sessions.filter(s => s.status === 'free').length,
      total_owed,
      total_paid,
      balance: total_owed - total_paid,
    },
  });
});

module.exports = router;
```

- [ ] **Step 5: Update `backend/src/app.js` to register payments and ledger routes**

Read the current app.js, then add after `app.use('/api/attendance', attendanceRoutes)`:

```javascript
const paymentRoutes = require('./routes/payments');
const ledgerRoutes = require('./routes/ledger');

app.use('/api/payments', paymentRoutes);
app.use('/api/students', ledgerRoutes);  // handles /:id/ledger — does not conflict with studentRoutes
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/payments.test.js
```
Expected: PASS (all tests green)

- [ ] **Step 7: Commit**

```bash
# Run from project root
git add backend/src/routes/payments.js backend/src/routes/ledger.js backend/src/app.js backend/tests/payments.test.js
git commit -m "feat: add payments and ledger routes"
```

---

### Task 3: Backend — dashboard + parent routes + tests

**Files:**
- Create: `backend/src/routes/dashboard.js`
- Create: `backend/src/routes/parent.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/dashboard.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/dashboard.test.js`:

```javascript
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let studentId;
let parentToken;
let scheduleId;
let attendanceId;
let paymentId;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = loginRes.body.token;

  // Create test student (parent_access_token auto-generated by Supabase default)
  const stuRes = await supabase.from('students').insert({
    name: 'Dashboard Test Student', date_of_birth: '2014-01-01',
    skill_level: 'Beginner', parent_name: 'Dash Parent',
    parent_phone: '555-4444', parent_email: 'dash@test.com',
  }).select().single();
  studentId = stuRes.data.id;
  parentToken = stuRes.data.parent_access_token;

  // Create a schedule in the future (within 14 days)
  const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const schedRes = await supabase.from('schedules').insert({
    date: futureDate, time: '10:00', duration_minutes: 60,
    location: 'Dash Court', age_category: 'U13', fee: 20,
  }).select().single();
  scheduleId = schedRes.data.id;

  // Mark student as present
  const attRes = await supabase.from('attendance').insert({
    schedule_id: scheduleId, student_id: studentId,
    status: 'present', checked_in_at: new Date().toISOString(),
  }).select().single();
  attendanceId = attRes.data.id;

  // Record a partial payment ($10 of $20 owed)
  const payRes = await supabase.from('payments').insert({
    student_id: studentId, amount: 10, payment_date: new Date().toISOString().slice(0, 10),
  }).select().single();
  paymentId = payRes.data.id;
});

afterAll(async () => {
  if (paymentId) await supabase.from('payments').delete().eq('id', paymentId);
  if (attendanceId) await supabase.from('attendance').delete().eq('id', attendanceId);
  if (scheduleId) await supabase.from('schedules').delete().eq('id', scheduleId);
  if (studentId) await supabase.from('students').delete().eq('id', studentId);
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/dashboard', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns upcoming_sessions and student_balances arrays', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.upcoming_sessions)).toBe(true);
    expect(Array.isArray(res.body.student_balances)).toBe(true);
  });

  it('includes the upcoming test session', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());
    const found = res.body.upcoming_sessions.find(s => s.id === scheduleId);
    expect(found).toBeDefined();
  });

  it('includes the student with outstanding balance', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());
    const found = res.body.student_balances.find(s => s.id === studentId);
    expect(found).toBeDefined();
    expect(found.balance).toBe(10); // $20 owed − $10 paid
  });
});

describe('GET /api/parent/:token', () => {
  it('returns student data without auth header', async () => {
    const res = await request(app).get(`/api/parent/${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.student.name).toBe('Dashboard Test Student');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body).toHaveProperty('summary');
  });

  it('does not expose sensitive student fields', async () => {
    const res = await request(app).get(`/api/parent/${parentToken}`);
    expect(res.body.student).not.toHaveProperty('parent_phone');
    expect(res.body.student).not.toHaveProperty('parent_email');
    expect(res.body.student).not.toHaveProperty('parent_access_token');
  });

  it('returns 404 for invalid token', async () => {
    const res = await request(app).get('/api/parent/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('computes correct totals', async () => {
    const res = await request(app).get(`/api/parent/${parentToken}`);
    expect(res.body.summary.total_owed).toBe(20);
    expect(res.body.summary.total_paid).toBe(10);
    expect(res.body.summary.balance).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
npm test -- tests/dashboard.test.js
```
Expected: FAIL (routes not registered)

- [ ] **Step 3: Create `backend/src/routes/dashboard.js`**

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// GET /api/dashboard
router.get('/', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Upcoming scheduled sessions in the next 14 days
  const { data: upcoming, error: upErr } = await supabase
    .from('schedules')
    .select('*')
    .eq('status', 'scheduled')
    .gte('date', today)
    .lte('date', twoWeeksLater)
    .order('date').order('time');
  if (upErr) return res.status(500).json({ error: upErr.message });

  // All present attendance with fees (for balance computation)
  const { data: attended, error: attErr } = await supabase
    .from('attendance')
    .select('student_id, schedule:schedules(fee)')
    .eq('status', 'present');
  if (attErr) return res.status(500).json({ error: attErr.message });

  // All payments
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('student_id, amount');
  if (payErr) return res.status(500).json({ error: payErr.message });

  // Compute per-student totals
  const owedMap = {};
  for (const a of attended || []) {
    owedMap[a.student_id] = (owedMap[a.student_id] || 0) + Number(a.schedule?.fee || 0);
  }
  const paidMap = {};
  for (const p of payments || []) {
    paidMap[p.student_id] = (paidMap[p.student_id] || 0) + Number(p.amount);
  }

  // Find active students with a non-zero balance
  const allIds = [...new Set([...Object.keys(owedMap), ...Object.keys(paidMap)])];
  let studentBalances = [];
  if (allIds.length > 0) {
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, name')
      .in('id', allIds)
      .eq('status', 'active');
    if (stuErr) return res.status(500).json({ error: stuErr.message });

    studentBalances = (students || [])
      .map(s => ({
        id: s.id,
        name: s.name,
        total_owed: owedMap[s.id] || 0,
        total_paid: paidMap[s.id] || 0,
        balance: (owedMap[s.id] || 0) - (paidMap[s.id] || 0),
      }))
      .filter(s => s.balance !== 0)
      .sort((a, b) => b.balance - a.balance);
  }

  res.json({ upcoming_sessions: upcoming || [], student_balances: studentBalances });
});

module.exports = router;
```

- [ ] **Step 4: Create `backend/src/routes/parent.js`**

```javascript
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { getAgeCategory } = require('../lib/ageCategory');

// No authMiddleware — this is a public endpoint using token-based access

// GET /api/parent/:token
router.get('/:token', async (req, res) => {
  // Look up student by parent_access_token (exclude sensitive fields)
  const { data: student, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level')
    .eq('parent_access_token', req.params.token)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Invalid link' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  // Get all non-absent attendance with schedule info
  const { data: attendance, error: attErr } = await supabase
    .from('attendance')
    .select('id, status, free_reason, checked_in_at, schedule:schedules(id, date, time, location, age_category, fee)')
    .eq('student_id', student.id)
    .neq('status', 'absent');
  if (attErr) return res.status(500).json({ error: attErr.message });

  // Get payments
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, amount, payment_date, notes, created_at')
    .eq('student_id', student.id)
    .order('payment_date', { ascending: false });
  if (payErr) return res.status(500).json({ error: payErr.message });

  const sessions = (attendance || []).sort(
    (a, b) => new Date(b.schedule?.date) - new Date(a.schedule?.date)
  );
  const total_owed = sessions
    .filter(s => s.status === 'present')
    .reduce((sum, s) => sum + Number(s.schedule?.fee || 0), 0);
  const total_paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    student: { ...student, age_category: getAgeCategory(student.date_of_birth) },
    sessions,
    payments: payments || [],
    summary: {
      total_sessions: sessions.length,
      present_sessions: sessions.filter(s => s.status === 'present').length,
      free_sessions: sessions.filter(s => s.status === 'free').length,
      total_owed,
      total_paid,
      balance: total_owed - total_paid,
    },
  });
});

module.exports = router;
```

- [ ] **Step 5: Update `backend/src/app.js` to register dashboard and parent routes**

Read the current app.js, then add after the ledger and payments routes from Task 2:

```javascript
const dashboardRoutes = require('./routes/dashboard');
const parentRoutes = require('./routes/parent');

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/parent', parentRoutes);
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/dashboard.test.js
```
Expected: PASS (all tests green)

- [ ] **Step 7: Commit**

```bash
# Run from project root
git add backend/src/routes/dashboard.js backend/src/routes/parent.js backend/src/app.js backend/tests/dashboard.test.js
git commit -m "feat: add dashboard and parent view routes"
```

---

### Task 4: Frontend — routing + nav + StudentList + api.delete

**Files:**
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Navbar.jsx`
- Modify: `frontend/src/components/students/StudentList.jsx`
- Create: `frontend/src/pages/DashboardPage.jsx` (placeholder)
- Create: `frontend/src/pages/LedgerPage.jsx` (placeholder)
- Create: `frontend/src/pages/ParentPage.jsx` (placeholder)

- [ ] **Step 1: Add `api.delete` to `frontend/src/lib/api.js`**

Read the file first. The current `api` export ends with `patch`. Add `delete` after `patch`:

```javascript
export const api = {
  get:    (path)       => request(path),
  post:   (path, body) => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body) => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body) => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path)       => request(path, { method: 'DELETE' }),
};
```

Note: `delete` is a reserved word in JS but is valid as an object property name in ES5+.

- [ ] **Step 2: Create placeholder pages**

Create `frontend/src/pages/DashboardPage.jsx`:
```jsx
export default function DashboardPage() {
  return <div className="text-gray-500">Dashboard — coming soon</div>;
}
```

Create `frontend/src/pages/LedgerPage.jsx`:
```jsx
export default function LedgerPage() {
  return <div className="text-gray-500">Ledger — coming soon</div>;
}
```

Create `frontend/src/pages/ParentPage.jsx`:
```jsx
export default function ParentPage() {
  return <div className="text-gray-500">Parent view — coming soon</div>;
}
```

- [ ] **Step 3: Update `frontend/src/App.jsx`**

Read the current file, then replace it with:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import StudentsPage from './pages/StudentsPage';
import SchedulesPage from './pages/SchedulesPage';
import AttendancePage from './pages/AttendancePage';
import DashboardPage from './pages/DashboardPage';
import LedgerPage from './pages/LedgerPage';
import ParentPage from './pages/ParentPage';

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
          <Route path="/dashboard" element={<ProtectedCoachPage><DashboardPage /></ProtectedCoachPage>} />
          <Route path="/students" element={<ProtectedCoachPage><StudentsPage /></ProtectedCoachPage>} />
          <Route path="/schedules" element={<ProtectedCoachPage><SchedulesPage /></ProtectedCoachPage>} />
          <Route path="/attendance/:scheduleId" element={<ProtectedCoachPage><AttendancePage /></ProtectedCoachPage>} />
          <Route path="/ledger/:studentId" element={<ProtectedCoachPage><LedgerPage /></ProtectedCoachPage>} />
          <Route path="/parent/:token" element={<ParentPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Update `frontend/src/components/layout/Navbar.jsx`**

Read the current file, then replace it with:

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
        <Link to="/dashboard" className="text-sm hover:underline">Dashboard</Link>
        <Link to="/students" className="text-sm hover:underline">Students</Link>
        <Link to="/schedules" className="text-sm hover:underline">Schedules</Link>
      </div>
      <button onClick={handleLogout} className="text-sm hover:underline">Logout</button>
    </nav>
  );
}
```

- [ ] **Step 5: Update `frontend/src/components/students/StudentList.jsx`**

Read the current file first. The actions cell currently has: Edit | Copy Link | Archive.

Add `useNavigate` import at the top and a Ledger button in the actions cell. The full updated file:

```jsx
import { useNavigate } from 'react-router-dom';

const CATEGORY_COLORS = {
  U13: 'bg-green-100 text-green-800',
  U15: 'bg-blue-100 text-blue-800',
  U17: 'bg-purple-100 text-purple-800',
  Adults: 'bg-orange-100 text-orange-800',
};

export default function StudentList({ students, onEdit, onArchive, onCopyLink }) {
  const navigate = useNavigate();

  if (students.length === 0) {
    return <p className="text-center text-gray-500 py-12">No students found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-3 py-2 border">Name</th>
            <th className="px-3 py-2 border">Age Category</th>
            <th className="px-3 py-2 border">Skill Level</th>
            <th className="px-3 py-2 border">Parent</th>
            <th className="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border font-medium">{student.name}</td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[student.age_category]}`}>
                  {student.age_category}
                </span>
              </td>
              <td className="px-3 py-2 border">{student.skill_level}</td>
              <td className="px-3 py-2 border">
                <div className="font-medium">{student.parent_name}</div>
                <div className="text-gray-500 text-xs">{student.parent_phone}</div>
              </td>
              <td className="px-3 py-2 border">
                <div className="flex gap-3">
                  <button onClick={() => onEdit(student)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => navigate(`/ledger/${student.id}`)} className="text-purple-600 hover:underline">Ledger</button>
                  <button onClick={() => onCopyLink(student)} className="text-green-600 hover:underline">Copy Link</button>
                  <button onClick={() => onArchive(student.id)} className="text-red-500 hover:underline">Archive</button>
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

- [ ] **Step 6: Verify the frontend builds**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/src/
git commit -m "feat: add routing for dashboard, ledger, parent; add Ledger button to students"
```

---

### Task 5: Frontend — LedgerPage

**Files:**
- Create: `frontend/src/components/payments/PaymentForm.jsx`
- Modify: `frontend/src/pages/LedgerPage.jsx` (replace placeholder)

- [ ] **Step 1: Create `frontend/src/components/payments/PaymentForm.jsx`**

```jsx
import { useState } from 'react';

export default function PaymentForm({ studentId, onSubmit, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amount: '', payment_date: today, notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        student_id: studentId,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        notes: form.notes || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Amount ($)</label>
        <input
          type="number" min="0.01" step="0.01" required
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. 80"
        />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Payment Date</label>
        <input
          type="date" required
          value={form.payment_date}
          onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Notes (optional)</label>
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. March payment"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Record Payment'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Replace `frontend/src/pages/LedgerPage.jsx` with full implementation**

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import PaymentForm from '../components/payments/PaymentForm';

const STATUS_BADGES = {
  present: 'bg-green-100 text-green-800',
  free:    'bg-yellow-100 text-yellow-800',
};

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

export default function LedgerPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => { loadLedger(); }, [studentId]);

  async function loadLedger() {
    setLoading(true);
    try {
      setData(await api.get(`/students/${studentId}/ledger`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(form) {
    await api.post('/payments', form);
    await loadLedger();
    setShowPaymentModal(false);
  }

  async function handleDeletePayment(id) {
    if (!confirm('Delete this payment?')) return;
    await api.delete(`/payments/${id}`);
    await loadLedger();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  const { student, sessions, payments, summary } = data;

  return (
    <div>
      <button onClick={() => navigate('/students')} className="text-blue-600 text-sm hover:underline mb-4 block">
        ← Back to Students
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{student.name}</h1>
          <p className="text-sm text-gray-500">{student.skill_level}</p>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
        >
          + Record Payment
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">${summary.total_owed.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Total Owed</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">${summary.total_paid.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Total Paid</div>
        </div>
        <div className={`rounded-lg p-4 text-center ${summary.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className={`text-2xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
            ${summary.balance.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">{summary.balance > 0 ? 'Outstanding' : 'Balance'}</div>
        </div>
      </div>

      {/* Sessions table */}
      <h2 className="text-lg font-semibold mb-2">Attended Sessions ({summary.total_sessions})</h2>
      {sessions.length === 0 ? (
        <p className="text-gray-400 text-sm mb-6">No sessions attended yet.</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2 border">Date</th>
                <th className="px-3 py-2 border">Location</th>
                <th className="px-3 py-2 border">Status</th>
                <th className="px-3 py-2 border text-right">Fee</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{s.schedule?.date}</td>
                  <td className="px-3 py-2 border">{s.schedule?.location}</td>
                  <td className="px-3 py-2 border">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[s.status]}`}>
                      {s.status}
                    </span>
                    {s.free_reason && (
                      <span className="text-xs text-gray-400 ml-1">({s.free_reason})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border text-right">
                    {s.status === 'free'
                      ? <span className="text-gray-400">Free</span>
                      : `$${Number(s.schedule?.fee || 0).toFixed(2)}`
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments table */}
      <h2 className="text-lg font-semibold mb-2">Payments ({payments.length})</h2>
      {payments.length === 0 ? (
        <p className="text-gray-400 text-sm">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2 border">Date</th>
                <th className="px-3 py-2 border text-right">Amount</th>
                <th className="px-3 py-2 border">Notes</th>
                <th className="px-3 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{p.payment_date}</td>
                  <td className="px-3 py-2 border text-right font-medium">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-3 py-2 border text-gray-500">{p.notes || '—'}</td>
                  <td className="px-3 py-2 border">
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPaymentModal && (
        <Modal title="Record Payment" onClose={() => setShowPaymentModal(false)}>
          <PaymentForm
            studentId={studentId}
            onSubmit={handleRecordPayment}
            onCancel={() => setShowPaymentModal(false)}
          />
        </Modal>
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
git commit -m "feat: add ledger page with session history and payment recording"
```

---

### Task 6: Frontend — DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx` (replace placeholder)

- [ ] **Step 1: Replace `frontend/src/pages/DashboardPage.jsx` with full implementation**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS = {
  U13:    'bg-green-100 text-green-800',
  U15:    'bg-blue-100 text-blue-800',
  U17:    'bg-purple-100 text-purple-800',
  Adults: 'bg-orange-100 text-orange-800',
  Mixed:  'bg-yellow-100 text-yellow-800',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (!data) return <p className="text-red-600">Failed to load dashboard.</p>;

  const { upcoming_sessions, student_balances } = data;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Upcoming Sessions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Upcoming Sessions <span className="text-gray-400 font-normal text-sm">(next 14 days)</span>
          </h2>
          {upcoming_sessions.length === 0 ? (
            <p className="text-gray-400 text-sm">No sessions scheduled in the next 14 days.</p>
          ) : (
            <div className="space-y-2">
              {upcoming_sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/attendance/${s.id}`)}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {DAYS[new Date(s.date + 'T00:00:00').getDay()]}, {s.date}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[s.age_category]}`}>
                      {s.age_category}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {s.time.slice(0, 5)} · {s.duration_minutes} min · {s.location}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outstanding Balances */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Outstanding Balances</h2>
          {student_balances.length === 0 ? (
            <p className="text-gray-400 text-sm">All students are up to date.</p>
          ) : (
            <div className="space-y-2">
              {student_balances.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/ledger/${s.id}`)}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className={`font-bold text-sm ${s.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {s.balance > 0
                      ? `Owes $${s.balance.toFixed(2)}`
                      : `Credit $${Math.abs(s.balance).toFixed(2)}`
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the frontend builds**

```bash
cd frontend
npm run build
```
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/pages/DashboardPage.jsx
git commit -m "feat: add dashboard with upcoming sessions and outstanding balances"
```

---

### Task 7: Frontend — ParentPage (public)

**Files:**
- Modify: `frontend/src/pages/ParentPage.jsx` (replace placeholder)

- [ ] **Step 1: Replace `frontend/src/pages/ParentPage.jsx` with full implementation**

Note: This page uses `fetch` directly (not `api`), because `api` auto-injects the coach Bearer token which we don't want here. The parent page is fully public.

```jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const STATUS_BADGES = {
  present: 'bg-green-100 text-green-800',
  free:    'bg-yellow-100 text-yellow-800',
};

export default function ParentPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/parent/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Invalid or expired link');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <p className="text-gray-400 text-sm mt-2">Please ask your coach for a new link.</p>
      </div>
    </div>
  );

  const { student, sessions, payments, summary } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-blue-200 text-sm">DTMS Badminton Coaching</p>
          <h1 className="text-xl font-bold">{student.name}</h1>
          <p className="text-blue-200 text-sm">{student.age_category} · {student.skill_level}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">

        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-xl font-bold">${summary.total_owed.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Owed</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-green-700">${summary.total_paid.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Paid</div>
          </div>
          <div className={`rounded-lg p-3 text-center shadow-sm ${summary.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className={`text-xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
              ${summary.balance.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">{summary.balance > 0 ? 'Outstanding' : 'Balance'}</div>
          </div>
        </div>

        {/* Attendance history */}
        <h2 className="text-base font-semibold mb-2">
          Attendance History <span className="text-gray-400 font-normal text-sm">({sessions.length} sessions)</span>
        </h2>
        {sessions.length === 0 ? (
          <p className="text-gray-400 text-sm mb-6">No sessions recorded yet.</p>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b">
                  <th className="px-4 py-2 font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Location</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Fee</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="px-4 py-2">{s.schedule?.date}</td>
                    <td className="px-4 py-2 text-gray-600">{s.schedule?.location}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {s.status === 'free'
                        ? <span className="text-gray-400">Free</span>
                        : `$${Number(s.schedule?.fee || 0).toFixed(2)}`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payments */}
        <h2 className="text-base font-semibold mb-2">
          Payments <span className="text-gray-400 font-normal text-sm">({payments.length})</span>
        </h2>
        {payments.length === 0 ? (
          <p className="text-gray-400 text-sm">No payments recorded yet.</p>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b">
                  <th className="px-4 py-2 font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Amount</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="px-4 py-2">{p.payment_date}</td>
                    <td className="px-4 py-2 text-right font-medium">${Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-2 text-gray-500">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the frontend builds**

```bash
cd frontend
npm run build
```
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/pages/ParentPage.jsx
git commit -m "feat: add public parent view with attendance history and payment summary"
```

---

## What's Next

- **Final code review**: Single pass across all 3 plans (Plans 1, 2, 3)
- **Deployment**: Deploy backend (e.g. Railway/Render) and frontend (e.g. Vercel/Netlify) — deferred
