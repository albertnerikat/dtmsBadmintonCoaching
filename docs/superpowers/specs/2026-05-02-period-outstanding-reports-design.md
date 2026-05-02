# Period Outstanding Reports Feature Design

**Date:** 2026-05-02  
**Status:** Design Phase

---

## 1. Overview

Add a new "Reports" page to the coaching management system that generates period-based financial reports. The page allows coaches to view outstanding amounts per student for a selected time period, with breakdown of previous period balance (carried forward) and current period outstanding. Fully mobile-responsive with optional filtering and CSV/PDF export.

---

## 2. Requirements

### 2.1 Functional Requirements

**Report Generation:**
- Period selection: calendar months OR custom date ranges
- Auto-detect previous period based on period type
  - Calendar month: previous = end of prior calendar month
  - Custom range: previous = before the start date
- Generate report for all active students (exclude archived)

**Balance Calculation:**
- **Previous Balance:** Outstanding amount (fees - payments) as of the period start date
- **Period Outstanding:** Fees from sessions in period minus payments in period
- **Total Outstanding:** Previous Balance + Period Outstanding
- Calculate per student and aggregate by age category

**Display Modes:**
- **Summary View:** Table/cards showing one row per student with balances
- **Detailed View:** Expandable/modal view showing:
  - Sessions within the period (date, location, fee, status)
  - Payments within the period (date, amount, notes)
  - Running balance calculation

**Filters:**
- Toggle: "Hide students with only free sessions" (optional, off by default)
- Dropdown: Filter by age category (All, U9, U11, U13, U15, U17, U19, Adults, Mixed)
- Only show active students (automatically exclude archived)

**Export:**
- CSV export: Name, Age Category, Previous Balance, Period Outstanding, Total Outstanding
- PDF export: Formatted report with date range, filters applied, summary stats, student details

### 2.2 Non-Functional Requirements

**Mobile Responsiveness:**
- All elements touch-friendly (44px minimum height/width for interactive elements)
- Responsive layout: hamburger menu on mobile, navbar on desktop
- Date pickers use native HTML inputs (OS calendar on mobile)
- Filters collapsible on mobile, inline on desktop
- Table converts to card layout on mobile
- Export buttons full-width stacked on mobile

**Performance:**
- Report generation should complete within 2 seconds for typical coaching academy (100-300 students)
- Lazy-load detailed view data (fetch on demand when user expands)

**Accessibility:**
- Semantic HTML, proper heading hierarchy
- Color not sole indicator of status (use icons/text too)
- Form labels properly associated with inputs
- Keyboard navigation throughout

---

## 3. Data Model

### 3.1 Database Queries

No schema changes needed. Leverage existing tables:
- `students` (id, name, status, skill_level)
- `schedules` (id, date, time, location, fee, age_category)
- `attendance` (id, student_id, schedule_id, status, free_reason, checked_in_at)
- `payments` (id, student_id, amount, payment_date, notes)
- `age_categories` (for filtering by category)

### 3.2 Outstanding Balance Logic

```
For a given student and period [start_date, end_date]:

1. previous_balance:
   - Sum all fees from sessions dated < start_date where status = 'present'
   - Subtract all payments dated < start_date
   - Result: amount owed as of start_date

2. period_fees:
   - Sum all fees from sessions where date is in [start_date, end_date] and status = 'present'

3. period_payments:
   - Sum all payments where payment_date is in [start_date, end_date]

4. period_outstanding:
   - period_fees - period_payments

5. total_outstanding:
   - previous_balance + period_outstanding

6. is_free_only:
   - True if all sessions in period have status = 'free'
```

### 3.3 Period Definition

**Calendar Month:**
- User selects month/year (e.g., "March 2026")
- start_date = 2026-03-01
- end_date = 2026-03-31
- previous_boundary = 2026-02-28

**Custom Date Range:**
- User selects start and end dates
- previous_boundary = day before start_date

---

## 4. API Specification

### 4.1 New Endpoint: GET /api/reports/period-outstanding

**Purpose:** Fetch outstanding balances for all active students in a given period.

**Request:**
```
GET /api/reports/period-outstanding
Query Parameters:
  - start_date (required): ISO date string (YYYY-MM-DD)
  - end_date (required): ISO date string (YYYY-MM-DD)
  - hide_free_only (optional): boolean, default false
  - age_category (optional): string, default null (all categories)
  
Example:
GET /api/reports/period-outstanding?start_date=2026-03-01&end_date=2026-03-31&hide_free_only=false&age_category=U13
```

**Response:**
```json
{
  "period": {
    "start_date": "2026-03-01",
    "end_date": "2026-03-31",
    "period_type": "calendar_month"
  },
  "filters": {
    "age_category": "U13",
    "hide_free_only": false
  },
  "summary": {
    "total_students": 12,
    "total_previous_balance": 450.00,
    "total_period_outstanding": 680.00,
    "total_outstanding": 1130.00
  },
  "students": [
    {
      "id": "uuid-1",
      "name": "John Doe",
      "age_category": "U13",
      "previous_balance": 40.00,
      "period_outstanding": 50.00,
      "total_outstanding": 90.00,
      "is_free_only": false,
      "status": "active"
    },
    ...
  ]
}
```

### 4.2 Enhanced Endpoint: GET /api/reports/period-outstanding/:student_id/details

**Purpose:** Fetch detailed session and payment breakdown for a student in a given period (lazy-loaded).

**Request:**
```
GET /api/reports/period-outstanding/:student_id/details?start_date=2026-03-01&end_date=2026-03-31
```

**Response:**
```json
{
  "student_id": "uuid-1",
  "period": { "start_date": "...", "end_date": "..." },
  "sessions": [
    {
      "id": "uuid",
      "date": "2026-03-05",
      "location": "Court A",
      "age_category": "U13",
      "status": "present",
      "fee": 15.00
    }
  ],
  "payments": [
    {
      "id": "uuid",
      "payment_date": "2026-03-10",
      "amount": 30.00,
      "notes": "Monthly payment"
    }
  ]
}
```

---

## 5. UI/UX Design

### 5.1 Page Structure

**ReportsPage Component:**
- PeriodSelector (calendar month vs custom dates)
- FilterSection (collapsible on mobile)
- ViewToggle (Summary / Detailed)
- ReportTable/ReportCards (responsive layout)
- ExportButtons

### 5.2 Desktop Layout

```
┌─────────────────────────────────────────────────────┐
│ Reports | Students | Schedules | ...               │
└─────────────────────────────────────────────────────┘

Period Selector:
[Calendar Month ▼] [Start Date] [End Date] [Generate Report]

Filters & View:
□ Hide students with only free sessions    [All Categories ▼]
                                    [Summary] [Detailed]

Report Table:
┌────────────────────────────────────────────────────┐
│ Name    | Category | Previous | Period  | Total |St│
├────────────────────────────────────────────────────┤
│ John    | U13     | $40      | $50     | $90  | 🔴│
│ Sarah   | U11     | $0       | $80     | $80  | 🔴│
│ (expand)→ [Session details...]                    │
└────────────────────────────────────────────────────┘

Export Options (bottom-right):
[CSV Export] [PDF Export]
```

### 5.3 Mobile Layout

```
┌─────────────────────────┐
│ ☰ Menu                  │ ← Hamburger: includes Reports
├─────────────────────────┤
│ Period Selector         │
│ [Calendar Month ▼]      │
│ [Start] [End]           │
│ [Generate Report]       │ ← Full width
├─────────────────────────┤
│ [Filters ▼]             │ ← Collapsible (collapsed by default)
├─────────────────────────┤
│ [Summary | Detailed]    │ ← Toggle buttons, full width
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ John Doe            │ │
│ │ U13                 │ │
│ │ Prev: $40           │ │
│ │ Period: $50         │ │
│ │ Total: $90          │ │ ← Card, tap to expand
│ │ Status: Outstanding │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Sarah Ahmed         │ │
│ │ ...                 │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ [Export as CSV]         │
│ [Export as PDF]         │ ← Full width, stacked
└─────────────────────────┘
```

### 5.4 States & Interactions

**Period Selector:**
- Default: Calendar Month, current month
- Toggle between "Calendar Month" and "Custom Dates"
- On toggle, swap input controls

**Filters:**
- Mobile: Collapsible (starts collapsed)
- Desktop: Always visible
- Selection updates report in real-time or on "Generate Report" button

**View Toggle:**
- Summary (default): Compact table/cards
- Detailed: Expands to show session/payment breakdown
  - Desktop: Expandable rows in table
  - Mobile: Tap card to open modal/slide-up panel with details

**Detail Modal/Panel (Mobile):**
- Slide-up from bottom, or centered modal (slide-up preferred for mobile UX)
- Shows sessions and payments in scrollable list
- Close button (X or back arrow)

**Export:**
- CSV: Direct download, filename = `reports_outstanding_YYYY-MM-DD_to_YYYY-MM-DD.csv`
- PDF: Direct download, filename = `reports_outstanding_YYYY-MM-DD_to_YYYY-MM-DD.pdf`
  - PDF includes: header with date range, filters applied, summary stats, full report table

### 5.5 Color & Status Indicators

- **Outstanding ($0+):** Red badge/highlight + text "Outstanding"
- **Paid/Zero balance:** Green badge/highlight + text "Paid" or "—"
- **Free-only sessions:** Yellow/gray badge (if shown) indicating no fees
- **Age categories:** Use existing color scheme from DashboardPage (U9=pink, U11=cyan, etc.)

---

## 6. Implementation Scope

### 6.1 Backend

**New files:**
- `backend/src/routes/reports.js` — Reports route handler
- `backend/src/lib/reportCalculations.js` — Outstanding balance calculations

**Changes:**
- `backend/src/app.js` — Add reports route

**Logic to implement:**
- Period detection and validation
- Outstanding balance calculation per student
- Aggregate calculations (totals, summaries)
- Filtering by age category and free-only status
- CSV export formatting
- PDF export formatting (use library like `pdfkit` or `jsPDF`)

### 6.2 Frontend

**New files:**
- `frontend/src/pages/ReportsPage.jsx` — Main reports page
- `frontend/src/components/reports/PeriodSelector.jsx` — Period selection controls
- `frontend/src/components/reports/FilterSection.jsx` — Collapsible filters
- `frontend/src/components/reports/ViewToggle.jsx` — Summary/Detailed toggle
- `frontend/src/components/reports/ReportTable.jsx` — Desktop summary table
- `frontend/src/components/reports/ReportCards.jsx` — Mobile summary cards
- `frontend/src/components/reports/DetailPanel.jsx` — Modal/panel for detailed view
- `frontend/src/lib/exportReports.js` — CSV/PDF export utilities

**Changes:**
- `frontend/src/App.jsx` — Add Reports route
- Navigation component — Add Reports link (visible on desktop nav, hamburger menu on mobile)

**Libraries to use:**
- CSV export: `papaparse` (already likely installed) or native CSV formatting
- PDF export: `pdfkit` (backend) or `jsPDF` (frontend) — recommend backend for better control

### 6.3 Database

No schema changes required.

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Backend:**
- `reportCalculations.test.js`:
  - Test outstanding balance calculation for single student
  - Test with previous balance scenarios
  - Test free-only filtering
  - Test edge cases (no sessions, no payments, all free sessions)

### 7.2 Integration Tests

**API endpoint tests:**
- GET /api/reports/period-outstanding with various filters
- Date range validation (invalid dates, end before start)
- Permission check (only authenticated users)

### 7.3 UI/UX Tests (Manual)

**Desktop:**
- Period selection (calendar month and custom dates)
- Filter application and clearing
- Summary/Detailed toggle
- Expand student details in table
- CSV/PDF export

**Mobile:**
- Hamburger menu includes Reports link
- Period selector responsive
- Filters collapse/expand
- Card layout and tap-to-expand
- Detail panel slide-up and close
- Export buttons full-width and stacked

**Cross-browser:** Chrome, Firefox, Safari, Edge

---

## 8. Performance Considerations

**Optimization strategies:**
- Pre-compute totals in report response to avoid client-side aggregation
- Lazy-load detailed view data (don't fetch session/payment details until user expands)
- Index on `attendance.student_id`, `attendance.status`, `payments.student_id`, `payments.payment_date` (likely already exist)
- Cache period report for 5 minutes if same params requested again (optional, for high traffic)

**Expected latency:**
- Report generation: < 2 seconds for 100-300 students
- Detail fetch: < 500ms per student

---

## 9. Future Enhancements (Out of Scope)

- Scheduled report generation (email to coach)
- Comparison between periods (month-over-month)
- Aging analysis (how long outstanding amounts have been owed)
- Payment plan tracking
- Student-specific drill-down (from report to full ledger page)

---

## 10. Success Criteria

✅ Report generates for calendar month and custom date ranges  
✅ Previous balance correctly calculated  
✅ All active students shown (or filtered)  
✅ Summary and detailed views both functional  
✅ CSV and PDF export work correctly  
✅ Mobile responsive (44px touch targets, collapsible filters, card layout)  
✅ All tests passing  
✅ Hamburger menu includes Reports on mobile  

---
