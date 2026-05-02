# Period Outstanding Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Reports page allowing coaches to generate period-based outstanding balance reports with period selection, filtering, summary/detailed views, and CSV/PDF export.

**Architecture:** 
- Backend: New reports route with calculation logic for outstanding balances (previous period + current period). Lazy-loads detail data on demand.
- Frontend: Responsive ReportsPage with period/filter controls, summary table (desktop) / cards (mobile), expandable details, and export utilities.
- Data: Leverages existing students, schedules, attendance, payments tables—no schema changes.

**Tech Stack:** Node.js/Express (backend), React (frontend), Supabase (database), PapaParse (CSV), pdfkit (PDF backend).

---

## Phase 1: Backend - Calculations & Core Endpoints

### Task 1: Create Report Calculations Library

**Files:**
- Create: `backend/src/lib/reportCalculations.js`
- Create: `backend/src/lib/reportCalculations.test.js`

- [ ] **Step 1: Write failing tests for outstanding balance calculation**

Create `backend/src/lib/reportCalculations.test.js`:

```javascript
const { calculateStudentBalance, detectPeriodType } = require('./reportCalculations');

describe('reportCalculations', () => {
  describe('detectPeriodType', () => {
    test('detects calendar month', () => {
      const result = detectPeriodType('2026-03-01', '2026-03-31');
      expect(result).toBe('calendar_month');
    });

    test('detects custom range', () => {
      const result = detectPeriodType('2026-03-15', '2026-04-14');
      expect(result).toBe('custom_range');
    });

    test('rejects invalid dates', () => {
      expect(() => detectPeriodType('2026-03-31', '2026-03-01')).toThrow('end_date must be after start_date');
    });
  });

  describe('calculateStudentBalance', () => {
    test('calculates balance with sessions and payments', () => {
      const sessions = [
        { date: '2026-02-15', status: 'present', fee: 20 },
        { date: '2026-03-10', status: 'present', fee: 15 },
      ];
      const payments = [
        { payment_date: '2026-02-20', amount: 10 },
        { payment_date: '2026-03-15', amount: 5 },
      ];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.previous_balance).toBe(10); // 20 - 10
      expect(result.period_outstanding).toBe(10); // 15 - 5
      expect(result.total_outstanding).toBe(20); // 10 + 10
    });

    test('handles free sessions (excludes from fees)', () => {
      const sessions = [
        { date: '2026-03-10', status: 'present', fee: 15 },
        { date: '2026-03-15', status: 'free', fee: 15 },
      ];
      const payments = [];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.period_outstanding).toBe(15); // Only present sessions count
      expect(result.is_free_only).toBe(false); // Has at least one present
    });

    test('marks as free_only when all sessions are free', () => {
      const sessions = [
        { date: '2026-03-10', status: 'free', fee: 15 },
        { date: '2026-03-15', status: 'free', fee: 15 },
      ];
      const payments = [];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.is_free_only).toBe(true);
      expect(result.period_outstanding).toBe(0);
    });

    test('handles no sessions', () => {
      const result = calculateStudentBalance([], [], '2026-03-01');
      expect(result.previous_balance).toBe(0);
      expect(result.period_outstanding).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
cd backend
npm test -- src/lib/reportCalculations.test.js
```

Expected output: All tests fail (module doesn't exist yet).

- [ ] **Step 3: Implement reportCalculations.js**

Create `backend/src/lib/reportCalculations.js`:

```javascript
/**
 * Detect period type based on start and end dates
 * @param {string} startDate - ISO date (YYYY-MM-DD)
 * @param {string} endDate - ISO date (YYYY-MM-DD)
 * @returns {string} 'calendar_month' or 'custom_range'
 */
function detectPeriodType(startDate, endDate) {
  if (new Date(endDate) <= new Date(startDate)) {
    throw new Error('end_date must be after start_date');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if it's a full calendar month (1st to last day)
  const isFirstDay = start.getDate() === 1;
  const isLastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() === end.getDate();
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  return isFirstDay && isLastDay && sameMonth ? 'calendar_month' : 'custom_range';
}

/**
 * Calculate outstanding balance for a student across a period
 * @param {array} sessions - Attendance records with { date, status, fee }
 * @param {array} payments - Payment records with { payment_date, amount }
 * @param {string} periodStartDate - Period start (YYYY-MM-DD)
 * @returns {object} { previous_balance, period_outstanding, total_outstanding, is_free_only }
 */
function calculateStudentBalance(sessions, payments, periodStartDate) {
  const startDate = new Date(periodStartDate);

  // Split sessions into before and during period
  const sessionsBefore = sessions.filter(s => new Date(s.date) < startDate && s.status === 'present');
  const sessionsDuring = sessions.filter(s => new Date(s.date) >= startDate && s.status === 'present');
  const paymentsBefore = payments.filter(p => new Date(p.payment_date) < startDate);
  const paymentsDuring = payments.filter(p => new Date(p.payment_date) >= startDate);

  // Calculate fees and payment totals
  const feesBefore = sessionsBefore.reduce((sum, s) => sum + Number(s.fee || 0), 0);
  const feesDuring = sessionsDuring.reduce((sum, s) => sum + Number(s.fee || 0), 0);
  const amountBefore = paymentsBefore.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const amountDuring = paymentsDuring.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const previous_balance = feesBefore - amountBefore;
  const period_outstanding = feesDuring - amountDuring;
  const total_outstanding = previous_balance + period_outstanding;

  // Check if all period sessions are free
  const allSessionsDuring = sessions.filter(s => new Date(s.date) >= startDate);
  const is_free_only = allSessionsDuring.length > 0 && sessionsDuring.length === 0;

  return {
    previous_balance: Math.max(previous_balance, 0), // Never negative
    period_outstanding: Math.max(period_outstanding, 0),
    total_outstanding: Math.max(total_outstanding, 0),
    is_free_only,
  };
}

module.exports = { detectPeriodType, calculateStudentBalance };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
npm test -- src/lib/reportCalculations.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/lib/reportCalculations.js src/lib/reportCalculations.test.js
git commit -m "feat: add report balance calculation library with tests"
```

---

### Task 2: Create Reports Route with GET /api/reports/period-outstanding

**Files:**
- Create: `backend/src/routes/reports.js`

- [ ] **Step 1: Create reports.js route handler**

Create `backend/src/routes/reports.js`:

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { decryptStudent } = require('../lib/encryption');
const { calculateStudentBalance, detectPeriodType } = require('../lib/reportCalculations');

router.use(authMiddleware);

/**
 * GET /api/reports/period-outstanding
 * Generate period-based outstanding report for all active students
 * Query params: start_date, end_date, hide_free_only (optional), age_category (optional)
 */
router.get('/period-outstanding', async (req, res) => {
  try {
    const { start_date, end_date, hide_free_only = 'false', age_category } = req.query;

    // Validate required params
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Validate date format and order
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    // Detect period type
    const periodType = detectPeriodType(start_date, end_date);

    // Fetch all active students
    let studentsQuery = supabase
      .from('students')
      .select('id, name, status, skill_level')
      .eq('status', 'active');

    const { data: rawStudents, error: studentErr } = await studentsQuery;
    if (studentErr) return res.status(500).json({ error: studentErr.message });

    // Fetch age categories for each student (via schedules)
    const { data: ageData, error: ageErr } = await supabase
      .from('schedules')
      .select('age_category')
      .in('id', 
        (await supabase
          .from('attendance')
          .select('schedule_id')
          .in('student_id', rawStudents.map(s => s.id))
        ).data?.map(a => a.schedule_id) || []
      );

    // Fetch all attendance and payments for the period (and before)
    const { data: allAttendance, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, status, free_reason, schedule:schedules(date, fee, age_category)')
      .in('student_id', rawStudents.map(s => s.id))
      .neq('status', 'absent');

    if (attErr) return res.status(500).json({ error: attErr.message });

    const { data: allPayments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .in('student_id', rawStudents.map(s => s.id));

    if (payErr) return res.status(500).json({ error: payErr.message });

    // Group attendance and payments by student
    const attendanceByStudent = {};
    const paymentsByStudent = {};

    (allAttendance || []).forEach(att => {
      if (!attendanceByStudent[att.student_id]) {
        attendanceByStudent[att.student_id] = [];
      }
      attendanceByStudent[att.student_id].push({
        date: att.schedule?.date,
        status: att.status,
        free_reason: att.free_reason,
        fee: att.schedule?.fee,
        age_category: att.schedule?.age_category,
      });
    });

    (allPayments || []).forEach(pay => {
      if (!paymentsByStudent[pay.student_id]) {
        paymentsByStudent[pay.student_id] = [];
      }
      paymentsByStudent[pay.student_id].push({
        payment_date: pay.payment_date,
        amount: pay.amount,
        notes: pay.notes,
      });
    });

    // Calculate balances for each student
    const students = rawStudents
      .map(student => {
        const sessions = attendanceByStudent[student.id] || [];
        const payments = paymentsByStudent[student.id] || [];
        const balance = calculateStudentBalance(sessions, payments, start_date);

        // Get primary age category (most recent session)
        const primaryCategory = sessions.length > 0
          ? sessions[sessions.length - 1].age_category
          : 'Unknown';

        return {
          id: student.id,
          name: decryptStudent({ name: student.name }).name,
          age_category: primaryCategory,
          previous_balance: balance.previous_balance,
          period_outstanding: balance.period_outstanding,
          total_outstanding: balance.total_outstanding,
          is_free_only: balance.is_free_only,
          status: student.status,
        };
      })
      .filter(s => {
        // Apply filters
        if (hide_free_only === 'true' && s.is_free_only) return false;
        if (age_category && s.age_category !== age_category) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calculate summary totals
    const summary = {
      total_students: students.length,
      total_previous_balance: students.reduce((sum, s) => sum + s.previous_balance, 0),
      total_period_outstanding: students.reduce((sum, s) => sum + s.period_outstanding, 0),
      total_outstanding: students.reduce((sum, s) => sum + s.total_outstanding, 0),
    };

    res.json({
      period: {
        start_date,
        end_date,
        period_type: periodType,
      },
      filters: {
        age_category: age_category || null,
        hide_free_only: hide_free_only === 'true',
      },
      summary,
      students,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/period-outstanding/:student_id/details
 * Fetch detailed sessions and payments for a student in a period (lazy-loaded)
 */
router.get('/period-outstanding/:student_id/details', async (req, res) => {
  try {
    const { student_id } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Fetch student
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('id, name')
      .eq('id', student_id)
      .single();

    if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
    if (stuErr) return res.status(500).json({ error: stuErr.message });

    // Fetch sessions in period
    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('id, status, free_reason, checked_in_at, schedule:schedules(id, date, location, age_category, fee)')
      .eq('student_id', student_id)
      .neq('status', 'absent')
      .gte('schedule.date', start_date)
      .lte('schedule.date', end_date);

    if (attErr) return res.status(500).json({ error: attErr.message });

    // Fetch payments in period
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', student_id)
      .gte('payment_date', start_date)
      .lte('payment_date', end_date)
      .order('payment_date', { ascending: false });

    if (payErr) return res.status(500).json({ error: payErr.message });

    // Format sessions
    const sessions = (attendance || [])
      .sort((a, b) => new Date(b.schedule?.date) - new Date(a.schedule?.date))
      .map(att => ({
        id: att.id,
        date: att.schedule?.date,
        location: att.schedule?.location,
        age_category: att.schedule?.age_category,
        status: att.status,
        free_reason: att.free_reason,
        fee: att.status === 'present' ? att.schedule?.fee : 0,
      }));

    res.json({
      student_id,
      period: { start_date, end_date },
      sessions,
      payments: payments || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register reports route in app.js**

Modify `backend/src/app.js` (add line after other routes):

```javascript
const reportRoutes = require('./routes/reports');

// ... existing middleware and routes ...

app.use('/api/reports', reportRoutes);
```

- [ ] **Step 3: Test the endpoint manually**

```bash
cd backend
npm run dev
```

Then in another terminal:
```bash
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  "http://localhost:3001/api/reports/period-outstanding?start_date=2026-03-01&end_date=2026-03-31"
```

Expected: JSON response with period, filters, summary, and students array.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/routes/reports.js src/app.js
git commit -m "feat: add period-outstanding reports endpoints with balance calculations"
```

---

## Phase 2: Frontend - UI Components

### Task 3: Set up ReportsPage Component Structure

**Files:**
- Create: `frontend/src/pages/ReportsPage.jsx`
- Create: `frontend/src/components/reports/` (directory)

- [ ] **Step 1: Create ReportsPage with basic layout**

Create `frontend/src/pages/ReportsPage.jsx`:

```javascript
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import PeriodSelector from '../components/reports/PeriodSelector';
import FilterSection from '../components/reports/FilterSection';
import ViewToggle from '../components/reports/ViewToggle';
import ReportTable from '../components/reports/ReportTable';
import ReportCards from '../components/reports/ReportCards';
import DetailPanel from '../components/reports/DetailPanel';
import { exportAsCSV, exportAsPDF } from '../lib/exportReports';

export default function ReportsPage() {
  // State
  const [periodType, setPeriodType] = useState('calendar_month');
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hideFreOnly, setHideFreOnly] = useState(false);
  const [ageCategory, setAgeCategory] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Responsive check
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate report
  async function generateReport() {
    setLoading(true);
    setError('');
    try {
      let startDate, endDate;

      if (periodType === 'calendar_month') {
        const [year, month] = monthYear.split('-');
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month}-${lastDay}`;
      } else {
        startDate = customStart;
        endDate = customEnd;
        if (!startDate || !endDate) {
          setError('Please select both start and end dates');
          setLoading(false);
          return;
        }
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        hide_free_only: hideFreOnly,
      });
      if (ageCategory) params.append('age_category', ageCategory);

      const data = await api.get(`/reports/period-outstanding?${params}`);
      setReportData(data);
      setSelectedStudentId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Export handlers
  function handleExportCSV() {
    if (!reportData) return;
    exportAsCSV(reportData);
  }

  function handleExportPDF() {
    if (!reportData) return;
    exportAsPDF(reportData);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Period-based outstanding balance report</p>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        periodType={periodType}
        setPeriodType={setPeriodType}
        monthYear={monthYear}
        setMonthYear={setMonthYear}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        onGenerate={generateReport}
        loading={loading}
      />

      {/* Filters & View Toggle */}
      {reportData && (
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <FilterSection
            hideFreOnly={hideFreOnly}
            setHideFreOnly={setHideFreOnly}
            ageCategory={ageCategory}
            setAgeCategory={setAgeCategory}
            onFilterChange={generateReport}
            isMobile={isMobile}
          />
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Generating report...</div>
      ) : reportData ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Total Students</div>
              <div className="text-xl md:text-2xl font-bold">{reportData.summary.total_students}</div>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Previous Balance</div>
              <div className="text-xl md:text-2xl font-bold">${reportData.summary.total_previous_balance.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Period Outstanding</div>
              <div className="text-xl md:text-2xl font-bold">${reportData.summary.total_period_outstanding.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Total Outstanding</div>
              <div className="text-xl md:text-2xl font-bold text-red-600">${reportData.summary.total_outstanding.toFixed(2)}</div>
            </div>
          </div>

          {/* Report Table / Cards */}
          {isMobile ? (
            <ReportCards
              students={reportData.students}
              viewMode={viewMode}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          ) : (
            <ReportTable
              students={reportData.students}
              viewMode={viewMode}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          )}

          {/* Detail Panel */}
          {selectedStudentId && viewMode === 'detailed' && (
            <DetailPanel
              studentId={selectedStudentId}
              period={reportData.period}
              onClose={() => setSelectedStudentId(null)}
              isMobile={isMobile}
            />
          )}

          {/* Export Buttons */}
          <div className="flex flex-col md:flex-row gap-3 md:justify-end mt-6">
            <button
              onClick={handleExportCSV}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm md:text-base"
            >
              Export as CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm md:text-base"
            >
              Export as PDF
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Generate a report to get started
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/pages/ReportsPage.jsx
git commit -m "feat: create ReportsPage main component"
```

---

### Task 4: Create PeriodSelector Component

**Files:**
- Create: `frontend/src/components/reports/PeriodSelector.jsx`

- [ ] **Step 1: Create PeriodSelector component**

Create `frontend/src/components/reports/PeriodSelector.jsx`:

```javascript
export default function PeriodSelector({
  periodType,
  setPeriodType,
  monthYear,
  setMonthYear,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onGenerate,
  loading,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Period Selection</h2>

      {/* Period Type Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriodType('calendar_month')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            periodType === 'calendar_month'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Calendar Month
        </button>
        <button
          onClick={() => setPeriodType('custom_range')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            periodType === 'custom_range'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Custom Dates
        </button>
      </div>

      {/* Calendar Month Selector */}
      {periodType === 'calendar_month' && (
        <div className="flex gap-3 mb-4 flex-col md:flex-row">
          <input
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Custom Date Range Selector */}
      {periodType === 'custom_range' && (
        <div className="flex gap-3 mb-4 flex-col md:flex-row">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-2">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-2">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
      >
        {loading ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/reports/PeriodSelector.jsx
git commit -m "feat: create PeriodSelector component for period input"
```

---

### Task 5: Create FilterSection Component (Collapsible on Mobile)

**Files:**
- Create: `frontend/src/components/reports/FilterSection.jsx`

- [ ] **Step 1: Create FilterSection component**

Create `frontend/src/components/reports/FilterSection.jsx`:

```javascript
import { useState } from 'react';

const AGE_CATEGORIES = [
  { value: null, label: 'All Categories' },
  { value: 'U9', label: 'U9' },
  { value: 'U11', label: 'U11' },
  { value: 'U13', label: 'U13' },
  { value: 'U15', label: 'U15' },
  { value: 'U17', label: 'U17' },
  { value: 'U19', label: 'U19' },
  { value: 'Adults', label: 'Adults' },
  { value: 'Mixed', label: 'Mixed' },
];

export default function FilterSection({
  hideFreOnly,
  setHideFreOnly,
  ageCategory,
  setAgeCategory,
  onFilterChange,
  isMobile,
}) {
  const [expanded, setExpanded] = useState(!isMobile);

  const handleCheckbox = (e) => {
    setHideFreOnly(e.target.checked);
    onFilterChange();
  };

  const handleCategory = (e) => {
    setAgeCategory(e.target.value === 'null' ? null : e.target.value);
    onFilterChange();
  };

  if (isMobile) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between font-semibold text-gray-900"
        >
          <span>Filters</span>
          <span className="text-xl">{expanded ? '▼' : '▶'}</span>
        </button>

        {expanded && (
          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hideFreOnly}
                onChange={handleCheckbox}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Hide free-only students</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age Category</label>
              <select
                value={ageCategory ?? 'null'}
                onChange={handleCategory}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {AGE_CATEGORIES.map(cat => (
                  <option key={cat.value || 'all'} value={cat.value === null ? 'null' : cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-end gap-4">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={hideFreOnly}
          onChange={handleCheckbox}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="ml-2 text-sm text-gray-700">Hide free-only students</span>
      </label>

      <div className="flex items-end gap-2">
        <label className="block text-sm font-medium text-gray-700">Age Category</label>
        <select
          value={ageCategory ?? 'null'}
          onChange={handleCategory}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {AGE_CATEGORIES.map(cat => (
            <option key={cat.value || 'all'} value={cat.value === null ? 'null' : cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/reports/FilterSection.jsx
git commit -m "feat: create collapsible FilterSection component for mobile"
```

---

### Task 6: Create ViewToggle Component

**Files:**
- Create: `frontend/src/components/reports/ViewToggle.jsx`

- [ ] **Step 1: Create ViewToggle component**

Create `frontend/src/components/reports/ViewToggle.jsx`:

```javascript
export default function ViewToggle({ viewMode, setViewMode }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setViewMode('summary')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
          viewMode === 'summary'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Summary
      </button>
      <button
        onClick={() => setViewMode('detailed')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
          viewMode === 'detailed'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Detailed
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/reports/ViewToggle.jsx
git commit -m "feat: create ViewToggle component for summary/detailed modes"
```

---

### Task 7: Create ReportTable Component (Desktop Summary)

**Files:**
- Create: `frontend/src/components/reports/ReportTable.jsx`

- [ ] **Step 1: Create ReportTable component**

Create `frontend/src/components/reports/ReportTable.jsx`:

```javascript
export default function ReportTable({
  students,
  viewMode,
  selectedStudentId,
  setSelectedStudentId,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-200">
              <th className="px-4 py-3 font-semibold text-gray-900">Student Name</th>
              <th className="px-4 py-3 font-semibold text-gray-900">Age Category</th>
              <th className="px-4 py-3 font-semibold text-gray-900 text-right">Previous Balance</th>
              <th className="px-4 py-3 font-semibold text-gray-900 text-right">Period Outstanding</th>
              <th className="px-4 py-3 font-semibold text-gray-900 text-right">Total Outstanding</th>
              <th className="px-4 py-3 font-semibold text-gray-900">Status</th>
              {viewMode === 'detailed' && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={viewMode === 'detailed' ? 7 : 6} className="px-4 py-4 text-center text-gray-500">
                  No students found
                </td>
              </tr>
            ) : (
              students.map(student => (
                <tr
                  key={student.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    student.total_outstanding > 0 ? 'bg-red-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-gray-900 font-medium">{student.name}</td>
                  <td className="px-4 py-3 text-gray-600">{student.age_category}</td>
                  <td className="px-4 py-3 text-right font-medium">${student.previous_balance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">${student.period_outstanding.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${
                    student.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ${student.total_outstanding.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {student.total_outstanding > 0 ? (
                      <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                        Outstanding
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        Paid
                      </span>
                    )}
                  </td>
                  {viewMode === 'detailed' && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedStudentId(student.id)}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/reports/ReportTable.jsx
git commit -m "feat: create ReportTable component for desktop view"
```

---

### Task 8: Create ReportCards Component (Mobile Summary)

**Files:**
- Create: `frontend/src/components/reports/ReportCards.jsx`

- [ ] **Step 1: Create ReportCards component**

Create `frontend/src/components/reports/ReportCards.jsx`:

```javascript
export default function ReportCards({
  students,
  viewMode,
  selectedStudentId,
  setSelectedStudentId,
}) {
  return (
    <div className="space-y-3">
      {students.length === 0 ? (
        <div className="bg-white rounded-lg p-4 text-center text-gray-500">
          No students found
        </div>
      ) : (
        students.map(student => (
          <div
            key={student.id}
            className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${
              student.total_outstanding > 0 ? 'border-red-500' : 'border-green-500'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{student.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{student.age_category}</p>
              </div>
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                student.total_outstanding > 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {student.total_outstanding > 0 ? 'Outstanding' : 'Paid'}
              </span>
            </div>

            {/* Balance Info */}
            <div className="grid grid-cols-3 gap-2 mb-3 py-3 border-t border-b border-gray-100 text-center">
              <div>
                <div className="text-xs text-gray-500">Previous</div>
                <div className="font-semibold text-sm">${student.previous_balance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Period</div>
                <div className="font-semibold text-sm">${student.period_outstanding.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className={`font-bold text-sm ${
                  student.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  ${student.total_outstanding.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Details Button */}
            {viewMode === 'detailed' && (
              <button
                onClick={() => setSelectedStudentId(student.id)}
                className="w-full mt-2 text-blue-600 hover:underline text-sm font-medium py-2 bg-blue-50 rounded"
              >
                View Details
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/reports/ReportCards.jsx
git commit -m "feat: create ReportCards component for mobile summary view"
```

---

### Task 9: Create DetailPanel Component (Modal)

**Files:**
- Create: `frontend/src/components/reports/DetailPanel.jsx`

- [ ] **Step 1: Create DetailPanel component**

Create `frontend/src/components/reports/DetailPanel.jsx`:

```javascript
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export default function DetailPanel({ studentId, period, onClose, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDetails() {
      try {
        const response = await api.get(
          `/reports/period-outstanding/${studentId}/details?start_date=${period.start_date}&end_date=${period.end_date}`
        );
        setData(response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [studentId, period]);

  // Mobile: Slide-up panel
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />

        {/* Slide-up panel */}
        <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="font-bold text-gray-900">Session & Payment Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : (
              <>
                {/* Sessions */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Sessions</h3>
                  {data.sessions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sessions in this period</p>
                  ) : (
                    <div className="space-y-2">
                      {data.sessions.map(session => (
                        <div key={session.id} className="bg-gray-50 rounded p-3 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{session.date}</p>
                              <p className="text-gray-600">{session.location}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              session.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                          {session.fee > 0 && (
                            <p className="mt-2 text-right font-semibold text-gray-900">${session.fee.toFixed(2)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Payments</h3>
                  {data.payments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No payments in this period</p>
                  ) : (
                    <div className="space-y-2">
                      {data.payments.map(payment => (
                        <div key={payment.id} className="bg-green-50 rounded p-3 text-sm border-l-2 border-green-500">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{payment.payment_date}</p>
                              {payment.notes && <p className="text-gray-600">{payment.notes}</p>}
                            </div>
                            <p className="font-semibold text-green-700">${payment.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop: Modal
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <h2 className="font-bold text-lg text-gray-900">Session & Payment Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Sessions */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Sessions</h3>
                  {data.sessions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sessions in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {data.sessions.map(session => (
                        <div key={session.id} className="bg-gray-50 rounded p-3 text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{session.date}</p>
                              <p className="text-gray-600 text-xs">{session.location}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                              session.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                          {session.fee > 0 && (
                            <p className="text-right font-semibold text-gray-900">${session.fee.toFixed(2)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Payments</h3>
                  {data.payments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No payments in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {data.payments.map(payment => (
                        <div key={payment.id} className="bg-green-50 rounded p-3 text-sm border-l-2 border-green-500">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{payment.payment_date}</p>
                              {payment.notes && <p className="text-gray-600 text-xs">{payment.notes}</p>}
                            </div>
                            <p className="font-semibold text-green-700 whitespace-nowrap ml-2">${payment.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/reports/DetailPanel.jsx
git commit -m "feat: create DetailPanel with modal and slide-up layouts"
```

---

### Task 10: Create Export Utilities (CSV & PDF)

**Files:**
- Create: `frontend/src/lib/exportReports.js`

- [ ] **Step 1: Create export utilities**

Create `frontend/src/lib/exportReports.js`:

```javascript
/**
 * Export report data as CSV
 */
export function exportAsCSV(reportData) {
  const { period, filters, summary, students } = reportData;

  // Header rows
  const headers = [
    ['Period Outstanding Report'],
    [`Date Range: ${period.start_date} to ${period.end_date}`],
    [`Filters: Age Category=${filters.age_category || 'All'}, Hide Free=${filters.hide_free_only}`],
    [],
    ['Summary'],
    [`Total Students: ${summary.total_students}`],
    [`Total Previous Balance: $${summary.total_previous_balance.toFixed(2)}`],
    [`Total Period Outstanding: $${summary.total_period_outstanding.toFixed(2)}`],
    [`Total Outstanding: $${summary.total_outstanding.toFixed(2)}`],
    [],
    ['Student Details'],
  ];

  // Column headers
  const columnHeaders = [
    'Student Name',
    'Age Category',
    'Previous Balance',
    'Period Outstanding',
    'Total Outstanding',
  ];

  // Data rows
  const dataRows = students.map(s => [
    s.name,
    s.age_category,
    `$${s.previous_balance.toFixed(2)}`,
    `$${s.period_outstanding.toFixed(2)}`,
    `$${s.total_outstanding.toFixed(2)}`,
  ]);

  // Combine all rows
  const allRows = [...headers, columnHeaders, ...dataRows];

  // Convert to CSV
  const csv = allRows.map(row => 
    row.map(cell => {
      // Escape cells with commas or quotes
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reports_outstanding_${period.start_date}_to_${period.end_date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export report data as PDF
 * Note: This sends data to backend for PDF generation
 */
export async function exportAsPDF(reportData) {
  try {
    const response = await fetch('/api/reports/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports_outstanding_${reportData.period.start_date}_to_${reportData.period.end_date}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Error exporting PDF: ${error.message}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/lib/exportReports.js
git commit -m "feat: add CSV and PDF export utilities for reports"
```

---

### Task 11: Add PDF Export Route (Backend)

**Files:**
- Modify: `backend/src/routes/reports.js`

- [ ] **Step 1: Add PDF export endpoint to reports.js**

Add this to the end of `backend/src/routes/reports.js` (before `module.exports`):

```javascript
/**
 * POST /api/reports/export-pdf
 * Generate PDF from report data
 */
router.post('/export-pdf', async (req, res) => {
  try {
    const { period, summary, students } = req.body;

    // Install pdfkit: npm install pdfkit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reports_outstanding_${period.start_date}_to_${period.end_date}.pdf"`
    );

    doc.pipe(res);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('Period Outstanding Report', { align: 'center' });
    doc.moveDown(0.5);

    // Date range
    doc.fontSize(12).font('Helvetica').text(
      `Report Period: ${period.start_date} to ${period.end_date}`,
      { align: 'center' }
    );
    doc.moveDown(1);

    // Summary section
    doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Students: ${summary.total_students}`);
    doc.text(`Total Previous Balance: $${summary.total_previous_balance.toFixed(2)}`);
    doc.text(`Total Period Outstanding: $${summary.total_period_outstanding.toFixed(2)}`);
    doc.text(`Total Outstanding: $${summary.total_outstanding.toFixed(2)}`, { color: 'red' });
    doc.moveDown(1);

    // Student table header
    doc.fontSize(12).font('Helvetica-Bold').text('Student Details');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 250;
    const col4 = 350;
    const col5 = 450;
    const rowHeight = 20;

    // Table header row
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Student Name', col1, tableTop);
    doc.text('Age Category', col2, tableTop);
    doc.text('Previous Bal.', col3, tableTop);
    doc.text('Period Out.', col4, tableTop);
    doc.text('Total Out.', col5, tableTop);

    // Table divider
    doc.moveTo(col1, tableTop + rowHeight - 5).lineTo(550, tableTop + rowHeight - 5).stroke();

    // Table data rows
    doc.font('Helvetica').fontSize(9);
    let y = tableTop + rowHeight;

    students.forEach((student, idx) => {
      // Check page overflow
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc.text(student.name.substring(0, 20), col1, y);
      doc.text(student.age_category, col2, y);
      doc.text(`$${student.previous_balance.toFixed(2)}`, col3, y);
      doc.text(`$${student.period_outstanding.toFixed(2)}`, col4, y);

      // Color total outstanding red if > 0
      if (student.total_outstanding > 0) {
        doc.fillColor('red');
      }
      doc.text(`$${student.total_outstanding.toFixed(2)}`, col5, y);
      doc.fillColor('black');

      y += rowHeight;
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 2: Install pdfkit in backend**

```bash
cd backend
npm install pdfkit
```

- [ ] **Step 3: Commit**

```bash
cd backend
git add src/routes/reports.js package.json package-lock.json
git commit -m "feat: add PDF export endpoint and install pdfkit"
```

---

## Phase 3: Integration & Routing

### Task 12: Add Reports Route to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add Reports route**

Modify `frontend/src/App.jsx` to add the Reports route. Find the routes section and add:

```javascript
import ReportsPage from './pages/ReportsPage';

// In your Routes component, add:
<Route path="/reports" element={<ReportsPage />} />
```

Example context (find your existing route definitions):
```javascript
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import LedgerPage from './pages/LedgerPage';
import SchedulesPage from './pages/SchedulesPage';
import AttendancePage from './pages/AttendancePage';
import ReportsPage from './pages/ReportsPage';  // ADD THIS

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/ledger/:studentId" element={<LedgerPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/reports" element={<ReportsPage />} />  {/* ADD THIS */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/App.jsx
git commit -m "feat: add /reports route to App.jsx"
```

---

### Task 13: Add Reports Link to Navigation

**Files:**
- Modify: Navigation component (find and update)

- [ ] **Step 1: Find and update navigation**

Find your navigation component (likely in `frontend/src/components/Navigation.jsx` or similar). Add Reports link:

```javascript
// For desktop navbar, add:
<a href="/reports" className="hover:underline">Reports</a>

// For mobile hamburger menu, add:
<a href="/reports" className="block px-4 py-2 hover:bg-gray-100">Reports</a>
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/Navigation.jsx  # or whatever your nav file is called
git commit -m "feat: add Reports link to navigation menu"
```

---

## Phase 4: Testing & Refinement

### Task 14: Manual Integration Testing

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

- [ ] **Step 2: Test period selection and report generation**

- Navigate to http://localhost:5173/reports
- Generate report for current month (should load and show students)
- Switch to custom dates and generate report
- Verify period detection (calendar month vs custom range)

- [ ] **Step 3: Test filters**

- Apply "Hide free-only students" filter
- Filter by age category
- Verify report updates in real-time

- [ ] **Step 4: Test summary/detailed views**

- Toggle between Summary and Detailed views
- In detailed view, click "View Details" on a student (desktop) or "View Details" button (mobile)
- Verify modal/slide-up panel loads sessions and payments

- [ ] **Step 5: Test export**

- Export as CSV, verify file downloads and opens correctly
- Export as PDF, verify file downloads and opens correctly

- [ ] **Step 6: Test mobile responsiveness**

- Open browser DevTools (F12), toggle device toolbar
- Test on mobile viewport (375px width)
- Verify filters collapse/expand
- Verify cards display correctly
- Verify export buttons are full-width
- Test date pickers work on mobile

---

### Task 15: Final Polish and Bug Fixes

- [ ] **Step 1: Fix any styling issues**

Review visual layout, spacing, colors. Common issues:
- Alignment of table columns
- Mobile button sizing
- Modal backdrop opacity

- [ ] **Step 2: Fix any data display issues**

- Verify currency formatting ($X.XX)
- Verify date formatting is consistent
- Verify large numbers don't break layout

- [ ] **Step 3: Handle edge cases**

- Empty reports (no students after filtering)
- Very long student names (truncate or wrap)
- Reports with no sessions or payments

- [ ] **Step 4: Commit final polish**

```bash
git add .
git commit -m "fix: styling and edge case handling for reports feature"
```

---

## Summary

**Total Tasks:** 15
- **Backend:** 4 tasks (calculations, API endpoints, PDF export)
- **Frontend:** 7 tasks (main page, 6 components, exports)
- **Integration:** 2 tasks (routing, navigation)
- **Testing:** 2 tasks (integration testing, polish)

**Key Files Created:**
- Backend: `routes/reports.js`, `lib/reportCalculations.js`, `lib/reportCalculations.test.js`
- Frontend: `pages/ReportsPage.jsx`, 6 component files, `lib/exportReports.js`

**Key Features Implemented:**
✅ Period-based outstanding balance reporting  
✅ Calendar month & custom date range selection  
✅ Auto-detect previous period logic  
✅ Summary & detailed view toggle  
✅ Mobile-responsive design  
✅ Collapsible filters  
✅ CSV & PDF export  
✅ Active students only  
✅ Age category filtering  
✅ Free-only student filtering  

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-period-outstanding-reports.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task with two-stage review (fast iteration, catches context drift)

**2. Inline Execution** — I execute tasks here in this session with checkpoints (slower, but cohesive context)

**Which approach would you prefer?**
