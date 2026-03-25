# Dashboard Financial Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-student "Outstanding Balances" section on the Dashboard with a month-scoped "Financial Summary" — a hero card for the current month (always-expanded with student list) and collapsible rows for the past 6 months, each drilling down to a per-student breakdown that links to the ledger.

**Architecture:** The backend computes month-scoped owed/paid aggregates in a single pass over a 7-month date range (fees attributed by session date, payments by payment_date) and returns a `financial_summary` object. The frontend replaces the balances block with a hero card and a collapsible month list; a single `expandedMonth` React state string tracks which past month is open.

**Tech Stack:** Node.js/Express, Supabase (PostgREST), React 18, Tailwind CSS, Jest/Supertest

---

## File Map

| File | Change |
|---|---|
| `backend/tests/dashboard.test.js` | Replace `student_balances` tests with `financial_summary` tests |
| `backend/src/routes/dashboard.js` | Replace balance computation with month-scoped financial_summary logic |
| `frontend/src/pages/DashboardPage.jsx` | Replace "Outstanding Balances" block with FinancialSummary components |

---

### Task 1: Write failing backend tests

**Files:**
- Modify: `backend/tests/dashboard.test.js`

- [ ] **Step 1: Replace the two `student_balances` tests with `financial_summary` tests**

In `dashboard.test.js`, find and replace the two tests inside `describe('GET /api/dashboard', ...)`:

Remove:
```javascript
it('returns upcoming_sessions and student_balances arrays', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.upcoming_sessions)).toBe(true);
  expect(Array.isArray(res.body.student_balances)).toBe(true);
});

it('includes the student with outstanding balance', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  const found = res.body.student_balances.find(s => s.id === studentId);
  expect(found).toBeDefined();
  expect(found.balance).toBe(10); // $20 owed − $10 paid
});
```

Add in their place:
```javascript
it('returns upcoming_sessions and financial_summary', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.upcoming_sessions)).toBe(true);
  expect(res.body.financial_summary).toBeDefined();
  expect(res.body.financial_summary.current_month).toBeDefined();
  expect(Array.isArray(res.body.financial_summary.past_months)).toBe(true);
});

it('current_month has label, year, month, and aggregate fields', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  const cm = res.body.financial_summary.current_month;
  expect(cm).toHaveProperty('label');
  expect(cm).toHaveProperty('year');
  expect(cm).toHaveProperty('month');
  expect(typeof cm.total_owed).toBe('number');
  expect(typeof cm.total_paid).toBe('number');
  expect(typeof cm.outstanding).toBe('number');
  expect(cm.outstanding).toBe(cm.total_owed - cm.total_paid);
});

it('current_month.students includes test student with correct figures', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  const cm = res.body.financial_summary.current_month;
  const found = cm.students.find(s => s.id === studentId);
  expect(found).toBeDefined();
  expect(found.owed).toBe(20);   // $20 fee for present session this month
  expect(found.paid).toBe(10);   // $10 payment made today
  expect(found.balance).toBe(10);
});

it('past_months has exactly 6 entries', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  expect(res.body.financial_summary.past_months).toHaveLength(6);
});

it('past_months entries have required shape', async () => {
  const res = await request(app).get('/api/dashboard').set(auth());
  const first = res.body.financial_summary.past_months[0];
  expect(first).toHaveProperty('label');
  expect(first).toHaveProperty('year');
  expect(first).toHaveProperty('month');
  expect(first).toHaveProperty('total_owed');
  expect(first).toHaveProperty('total_paid');
  expect(first).toHaveProperty('outstanding');
  expect(Array.isArray(first.students)).toBe(true);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test -- --testPathPattern=dashboard
```

Expected: FAIL — `financial_summary` is undefined. The `student_balances` tests are also gone, so only the new tests run and fail.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/dashboard.test.js
git commit -m "test: replace student_balances tests with financial_summary shape tests"
```

---

### Task 2: Implement backend financial_summary

**Files:**
- Modify: `backend/src/routes/dashboard.js`

- [ ] **Step 1: Replace dashboard.js with the new implementation**

Overwrite `backend/src/routes/dashboard.js` with:

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { decryptStudent } = require('../lib/encryption');

router.use(authMiddleware);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

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

  // Last 2 past sessions (any status)
  const { data: recent, error: recentErr } = await supabase
    .from('schedules')
    .select('*')
    .lt('date', today)
    .order('date', { ascending: false }).order('time', { ascending: false })
    .limit(2);
  if (recentErr) return res.status(500).json({ error: recentErr.message });

  // ── Financial Summary ──────────────────────────────────────────────
  const now = new Date();

  // Full range: start of month 6 months ago → end of current month (single DB pass)
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);
  const rangeEndStr   = rangeEnd.toISOString().slice(0, 10);

  // Present attendance with schedule date + fee in range
  const { data: attended, error: attErr } = await supabase
    .from('attendance')
    .select('student_id, schedule:schedules!inner(date, fee)')
    .eq('status', 'present')
    .gte('schedules.date', rangeStartStr)
    .lte('schedules.date', rangeEndStr);
  if (attErr) return res.status(500).json({ error: attErr.message });

  // Payments in range
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('student_id, amount, payment_date')
    .gte('payment_date', rangeStartStr)
    .lte('payment_date', rangeEndStr);
  if (payErr) return res.status(500).json({ error: payErr.message });

  // Build per-month, per-student owed/paid maps
  // monthData key = "YYYY-M" (e.g. "2026-3")
  const monthData = {};

  const ensureMonth = (year, month) => {
    const key = `${year}-${month}`;
    if (!monthData[key]) monthData[key] = { year, month, students: {} };
    return key;
  };
  const ensureStudent = (key, sid) => {
    if (!monthData[key].students[sid]) monthData[key].students[sid] = { owed: 0, paid: 0 };
  };

  for (const a of attended || []) {
    const date = a.schedule?.date;
    if (!date) continue;
    const [y, m] = date.split('-').map(Number);
    const key = ensureMonth(y, m);
    ensureStudent(key, a.student_id);
    monthData[key].students[a.student_id].owed += Number(a.schedule?.fee || 0);
  }

  for (const p of payments || []) {
    const date = p.payment_date;
    if (!date) continue;
    const [y, m] = date.split('-').map(Number);
    const key = ensureMonth(y, m);
    ensureStudent(key, p.student_id);
    monthData[key].students[p.student_id].paid += Number(p.amount);
  }

  // Fetch names for all involved active students
  const allStudentIds = [...new Set(
    Object.values(monthData).flatMap(md => Object.keys(md.students))
  )];

  const studentNameMap = {};
  if (allStudentIds.length > 0) {
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, name')
      .in('id', allStudentIds)
      .eq('status', 'active');
    if (stuErr) return res.status(500).json({ error: stuErr.message });
    for (const s of (students || []).map(decryptStudent)) {
      studentNameMap[s.id] = s.name;
    }
  }

  // Build a month summary object for a given year/month
  const buildMonth = (year, month) => {
    const key = `${year}-${month}`;
    const data = monthData[key] || { students: {} };
    const students = Object.entries(data.students)
      .filter(([sid]) => studentNameMap[sid]) // active students only
      .map(([sid, { owed, paid }]) => ({
        id: sid,
        name: studentNameMap[sid],
        owed,
        paid,
        balance: owed - paid,
      }))
      .sort((a, b) => b.balance - a.balance);
    const total_owed = students.reduce((s, st) => s + st.owed, 0);
    const total_paid = students.reduce((s, st) => s + st.paid, 0);
    return {
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      total_owed,
      total_paid,
      outstanding: total_owed - total_paid,
      students,
    };
  };

  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const current_month = buildMonth(currentYear, currentMonth);

  // Past 6 months, most-recent first
  const past_months = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    past_months.push(buildMonth(d.getFullYear(), d.getMonth() + 1));
  }

  res.json({
    upcoming_sessions: upcoming || [],
    recent_sessions: (recent || []).reverse(),
    financial_summary: { current_month, past_months },
  });
});

module.exports = router;
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd backend && npm test -- --testPathPattern=dashboard
```

Expected: All dashboard tests PASS.

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
cd backend && npm test -- --runInBand
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/dashboard.js
git commit -m "feat: replace student_balances with month-scoped financial_summary in dashboard API"
```

---

### Task 3: Update frontend DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Replace DashboardPage.jsx with new implementation**

Overwrite `frontend/src/pages/DashboardPage.jsx` with:

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS = {
  U9:     'bg-pink-100 text-pink-800',
  U11:    'bg-cyan-100 text-cyan-800',
  U13:    'bg-green-100 text-green-800',
  U15:    'bg-blue-100 text-blue-800',
  U17:    'bg-purple-100 text-purple-800',
  U19:    'bg-indigo-100 text-indigo-800',
  Adults: 'bg-orange-100 text-orange-800',
  Mixed:  'bg-yellow-100 text-yellow-800',
};

// Shared student breakdown table — used in both the hero and expanded past months
function StudentBreakdownTable({ students, navigate, dark }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className={`text-xs ${dark ? 'opacity-70' : 'text-gray-400'}`}>
          <th className="py-1 px-2 text-left font-medium">Student</th>
          <th className="py-1 px-2 text-right font-medium">Owed</th>
          <th className="py-1 px-2 text-right font-medium">Paid</th>
          <th className="py-1 px-2 text-right font-medium">Balance</th>
        </tr>
      </thead>
      <tbody>
        {students.map(s => (
          <tr
            key={s.id}
            className={`border-t ${dark ? 'border-white/20' : 'border-gray-100'} ${
              s.balance > 0 ? (dark ? 'bg-red-500/20' : 'bg-red-50') : ''
            }`}
          >
            <td
              className={`py-1.5 px-2 underline cursor-pointer ${dark ? '' : 'text-blue-600'}`}
              onClick={() => navigate(`/ledger/${s.id}`)}
            >
              {s.name}
            </td>
            <td className="py-1.5 px-2 text-right">${s.owed.toFixed(2)}</td>
            <td className={`py-1.5 px-2 text-right ${dark ? '' : 'text-green-700'}`}>
              ${s.paid.toFixed(2)}
            </td>
            <td className={`py-1.5 px-2 text-right font-semibold ${
              s.balance > 0
                ? (dark ? 'text-red-200' : 'text-red-600')
                : (dark ? 'opacity-50' : 'text-gray-400')
            }`}>
              {s.balance > 0 ? `$${s.balance.toFixed(2)}` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CurrentMonthHero({ month, navigate }) {
  return (
    <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-xl p-4 text-white mb-4">
      <div className="text-xs font-semibold opacity-80 mb-3">{month.label} · Current Month</div>
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div>
          <div className="text-xl font-bold">${month.total_owed.toFixed(2)}</div>
          <div className="text-xs opacity-70 mt-0.5">Total Owed</div>
        </div>
        <div>
          <div className="text-xl font-bold">${month.total_paid.toFixed(2)}</div>
          <div className="text-xs opacity-70 mt-0.5">Total Paid</div>
        </div>
        <div className="bg-white/15 rounded-lg py-1">
          <div className="text-xl font-bold">${month.outstanding.toFixed(2)}</div>
          <div className="text-xs opacity-70 mt-0.5">Outstanding</div>
        </div>
      </div>
      {month.students.length > 0 ? (
        <div className="bg-white/10 rounded-lg p-3">
          <StudentBreakdownTable students={month.students} navigate={navigate} dark={true} />
          <p className="text-xs opacity-50 mt-2 text-right">Click student name → full ledger</p>
        </div>
      ) : (
        <p className="text-xs opacity-60 text-center py-2">No activity this month.</p>
      )}
    </div>
  );
}

function PastMonthsList({ months, navigate }) {
  const [expanded, setExpanded] = useState(null);

  const toggle = (key) => setExpanded(prev => prev === key ? null : key);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Previous 6 Months
      </div>
      <div className="grid grid-cols-4 gap-1 text-xs text-gray-400 uppercase tracking-wide px-2 pb-2">
        <span>Month</span>
        <span className="text-right">Owed</span>
        <span className="text-right">Paid</span>
        <span className="text-right">Outstanding</span>
      </div>
      {months.map(m => {
        const key = `${m.year}-${m.month}`;
        const isOpen = expanded === key;
        const shortLabel = `${m.label.slice(0, 3)} ${String(m.year).slice(2)}`;
        return (
          <div
            key={key}
            className={`rounded-lg mb-1 overflow-hidden border transition-colors ${
              isOpen ? 'border-blue-300' : 'border-transparent'
            }`}
          >
            <div
              onClick={() => toggle(key)}
              className={`grid grid-cols-4 gap-1 text-sm px-2 py-2 cursor-pointer rounded-lg transition-colors ${
                isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`font-medium ${isOpen ? 'text-blue-700' : 'text-gray-700'}`}>
                {shortLabel} {isOpen ? '▴' : '▾'}
              </span>
              <span className="text-right">${m.total_owed.toFixed(2)}</span>
              <span className="text-right text-green-700">${m.total_paid.toFixed(2)}</span>
              <span className={`text-right font-semibold ${
                m.outstanding > 0 ? 'text-red-600' : 'text-green-700'
              }`}>
                {m.outstanding > 0 ? `$${m.outstanding.toFixed(2)}` : '—'}
              </span>
            </div>
            {isOpen && (
              <div className="px-3 py-2 bg-gray-50 border-t border-blue-100">
                {m.students.length > 0 ? (
                  <>
                    <StudentBreakdownTable students={m.students} navigate={navigate} dark={false} />
                    <p className="text-xs text-gray-400 mt-2 text-right">
                      Click student name → full ledger
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-1">No activity this month.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (!data) return <p className="text-red-600">Failed to load dashboard.</p>;

  const { upcoming_sessions, recent_sessions, financial_summary } = data;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todaySessions = upcoming_sessions.filter(s => s.date === todayStr);
  const futureSessions = upcoming_sessions.filter(s => s.date > todayStr);

  function SessionCard({ s }) {
    return (
      <div
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
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-6">
          {/* Past Sessions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Past Sessions <span className="text-gray-400 font-normal text-sm">(last 2)</span>
            </h2>
            {recent_sessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No past sessions.</p>
            ) : (
              <div className="space-y-2">
                {recent_sessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {/* Today's Sessions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Today's Sessions</h2>
            {todaySessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No sessions scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {todaySessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {/* Upcoming Sessions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Upcoming Sessions <span className="text-gray-400 font-normal text-sm">(next 14 days)</span>
            </h2>
            {futureSessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No sessions scheduled in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {futureSessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Financial Summary</h2>
          <CurrentMonthHero month={financial_summary.current_month} navigate={navigate} />
          <PastMonthsList months={financial_summary.past_months} navigate={navigate} />
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Start the dev server and verify visually**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 and confirm:
- Right column shows "Financial Summary" heading
- Blue hero card shows current month label, three aggregate stats, and student list
- Students with outstanding balance appear with red balance text
- "Previous 6 Months" section appears below with 6 month rows
- Clicking a past month row expands it inline; clicking again collapses it
- Only one past month can be expanded at a time
- Clicking any student name navigates to `/ledger/:id`

- [ ] **Step 3: Run full backend test suite to confirm no regressions**

```bash
cd backend && npm test -- --runInBand
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.jsx
git commit -m "feat: replace outstanding balances with monthly financial summary on dashboard"
```
