# CSV Export for Student List — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add an "Export CSV" button to the Students page that downloads all active students as a CSV file compatible with Excel.

## Requirements

- Export **all active students** regardless of any active filter or search on the page
- Columns exported: **Name, Age Category, Skill Level, Parent Name, Parent Phone**
- File is downloaded directly in the browser as `students.csv`
- No backend changes required

## Implementation

### Location
`frontend/src/pages/StudentsPage.jsx`

### Button
An "Export CSV" button is added to the top-right header row, alongside the existing "+ Add Student" button.

### Data source
The `students` state in `StudentsPage` is populated by `GET /api/students` (default `status=active`), which returns **all active students** with no pagination (confirmed: the route uses a plain Supabase `.select('*').eq('status','active').order('name')` query with no `.range()` or `.limit()`). The export reads directly from the `students` state variable — not the `filtered` derived constant used by the table display. No additional fetch is required.

**Stale data:** If data changes after the page loads, the export reflects the state at load time. This is acceptable — the coach can refresh the page before exporting if needed.

### Field mappings
| CSV column | Student field |
|---|---|
| Name | `student.name` |
| Age Category | `student.age_category` |
| Skill Level | `student.skill_level` |
| Parent Name | `student.parent_name` |
| Parent Phone | `student.parent_phone` |

### Null / missing values
Adult students may have null `parent_name` and `parent_phone`. Export these as empty strings.

### Logic
A `handleExportCSV` function:
1. Builds a CSV string from the `students` state array (unfiltered — all active students)
2. Defines a header row: `Name,Age Category,Skill Level,Parent Name,Parent Phone`
3. Maps each student to a row; each value is:
   - Null/undefined replaced with empty string first
   - Wrapped in double-quotes (this also safely handles commas inside values)
   - Internal double-quotes escaped as `""` (RFC 4180)
4. Prepends a UTF-8 BOM (`\uFEFF`) to the content for correct Excel rendering on Windows
5. Creates a `Blob` with MIME type `text/csv;charset=utf-8`
6. Triggers a download via a temporary `<a>` element with `href` set to an object URL and `download="students.csv"`
7. Appends the `<a>` to the document, clicks it, and removes it; revokes the object URL in a `setTimeout(..., 100)` to ensure the browser has initiated the download before cleanup

### Button behaviour
The Export CSV button is always visible and enabled. The `students` state is initialised as `[]`, so if the list is empty the resulting CSV contains only the header row — no error handling is needed beyond the existing empty-array case.

### No changes to
- `StudentList.jsx`
- Backend routes
- Any other file

## Out of Scope

- Exporting archived students
- Exporting additional fields (e.g. date of birth, parent email, created date)
- Filtering the export by age category or search term
- A backend CSV endpoint
