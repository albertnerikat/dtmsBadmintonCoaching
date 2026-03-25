# Dashboard Financial Summary — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Replace the current "Outstanding Balances" section on the Dashboard with a new "Financial Summary" section. The new section shows **aggregate (all-student) totals** broken down by month — current month always expanded, past 6 months collapsible. Clicking a student name navigates to their full ledger.

---

## Current State

- `GET /api/dashboard` returns `student_balances`: per-student all-time balance (owed minus paid), filtered to non-zero balances only.
- `DashboardPage.jsx` renders each student as a clickable row showing their outstanding balance. Click navigates to `/ledger/:id`.

---

## New Behaviour

### Dashboard — Financial Summary Section

Replaces the "Outstanding Balances" block entirely.

#### Current Month (Hero Card)

- Blue gradient card, always rendered, no interaction required to reveal content.
- Header: month label (e.g. "March 2026 · Current Month").
- Three aggregate stat tiles: **Total Owed**, **Total Paid**, **Outstanding** (= owed − paid).
- Below the stats: an always-visible student table showing every active student who had activity (sessions attended or payments made) in the current month.
  - Columns: Student name | Owed | Paid | Balance
  - Rows with a non-zero balance highlighted with a red background tint.
  - Student name is a clickable link → navigates to `/ledger/:id`.

#### Past 6 Months (Collapsible Rows)

- Rendered below the hero inside a white card labelled "Previous 6 Months".
- Column headers: Month | Owed | Paid | Outstanding.
- Each month is one row showing aggregate totals (same three figures).
- Rows with a non-zero outstanding shown in red, settled months in green (or neutral).
- **Click a row → expands inline** to show the per-student breakdown table (same columns as the hero student table). Click again → collapses. Only one month expanded at a time.
- Student names in the expanded breakdown link to `/ledger/:id`.

---

## Data Model

### Attribution Rules (Option 1 — Event Dates)

| Figure | Source | Month attributed by |
|---|---|---|
| Owed | `attendance` rows where `status = 'present'`, joined to `schedules.fee` | `schedules.date` |
| Paid | `payments.amount` | `payments.payment_date` |
| Outstanding | Owed − Paid | — |

A payment made in April for a March session reduces April's "paid" total, not March's. This is intentional — it reflects cash flow accurately.

Only active students are included.

### Month Range

- **Current month:** calendar month of today's date (server time).
- **Past 6 months:** the 6 complete calendar months immediately before the current month (e.g. if today is March 2026, show Sep 2025 – Feb 2026).

---

## API Changes

### `GET /api/dashboard` — enhanced response

Add a new `financial_summary` field to the existing response. The `student_balances` field is **removed** and replaced by `financial_summary`. All other existing fields (`upcoming_sessions`, `recent_sessions`) are unchanged.

```json
{
  "upcoming_sessions": [...],
  "recent_sessions": [...],
  "financial_summary": {
    "current_month": {
      "label": "March 2026",
      "year": 2026,
      "month": 3,
      "total_owed": 1240.00,
      "total_paid": 980.00,
      "outstanding": 260.00,
      "students": [
        {
          "id": "uuid",
          "name": "Alice Tan",
          "owed": 80.00,
          "paid": 80.00,
          "balance": 0.00
        }
      ]
    },
    "past_months": [
      {
        "label": "February 2026",
        "year": 2026,
        "month": 2,
        "total_owed": 1380.00,
        "total_paid": 1380.00,
        "outstanding": 0.00,
        "students": [...]
      }
    ]
  }
}
```

`past_months` is ordered most-recent first (Feb → Sep).

---

## Frontend Changes

### `DashboardPage.jsx`

- Remove `student_balances` destructuring and the "Outstanding Balances" JSX block.
- Add `financial_summary` destructuring from the API response.
- Add a `FinancialSummary` component (can be defined in the same file or extracted) that renders:
  - `CurrentMonthHero` — the blue gradient card with always-visible student table.
  - `PastMonthsList` — the white card with collapsible month rows. Local state tracks which month (if any) is expanded (`expandedMonth` — a `year-month` string or `null`).

### Navigation

- Student name clicks: `navigate(\`/ledger/${student.id}\`)` — existing ledger page, no changes needed there.

### Removed

- The `student_balances` field is no longer used on the frontend.

---

## Backend Changes

### `backend/src/routes/dashboard.js`

Replace the balance computation block with month-scoped queries:

1. Determine the full date range: start = first day of the oldest past month (6 months before current), end = last day of the current month. All queries use a single pass over this range and group results by month in application code.
2. Query `attendance` joined to `schedules` for present sessions — select `student_id`, `schedule.fee`, `schedule.date`. Filter `schedule.date >= range_start AND schedule.date <= range_end`.
3. Query `payments` — select `student_id`, `amount`, `payment_date`. Filter `payment_date >= range_start AND payment_date <= range_end`.
4. Fetch student names for all student IDs found (active students only).
5. Aggregate per-month, per-student; roll up to monthly totals.
6. Return `financial_summary` in the existing response shape.

Existing `student_balances` computation is removed.

---

## Out of Scope

- The existing `LedgerPage` is unchanged — it still shows all-time totals.
- No filtering of the ledger by month (the link just opens the full ledger).
- No pagination of the student list within a month.
- No ability to record payments from the dashboard (use the ledger for that).
