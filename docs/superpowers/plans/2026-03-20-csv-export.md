# CSV Export for Student List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Export CSV" button to the Students page that downloads all active students as a CSV file compatible with Excel.

**Architecture:** Pure frontend implementation — no backend changes. A `handleExportCSV` function in `StudentsPage.jsx` reads from the existing `students` state (unfiltered, all active students), builds a RFC 4180-compliant CSV string with a UTF-8 BOM, and triggers a browser download. The button lives in the existing page header row.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4. No new dependencies. No frontend test framework is currently configured — no automated tests are written for this change.

---

### Task 1: Add `handleExportCSV` function and Export CSV button to `StudentsPage.jsx`

**Files:**
- Modify: `frontend/src/pages/StudentsPage.jsx`

**Spec reference:** `docs/superpowers/specs/2026-03-20-csv-export-design.md`

- [ ] **Step 1: Add the `handleExportCSV` function**

Inside `StudentsPage`, add this function after `handleCopyLink`:

```jsx
function handleExportCSV() {
  const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const header = ['Name', 'Age Category', 'Skill Level', 'Parent Name', 'Parent Phone'].join(',');
  const rows = students.map(s =>
    [s.name, s.age_category, s.skill_level, s.parent_name, s.parent_phone].map(escape).join(',')
  );
  const csv = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'students.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

Notes:
- `escape` wraps each value in double-quotes and escapes any embedded double-quotes as `""` (RFC 4180)
- `val ?? ''` converts null/undefined to empty string (handles Adults with no parent fields)
- `\uFEFF` is the UTF-8 BOM — required for correct rendering in Excel on Windows
- `\r\n` line endings are the CSV standard (RFC 4180)
- `students` is the unfiltered state variable (all active students), not the `filtered` derived constant

- [ ] **Step 2: Add the Export CSV button to the header row**

In the JSX, locate the existing header `div` containing the "+ Add Student" button:

```jsx
<div className="flex items-center justify-between mb-4">
  <h1 className="text-xl font-bold">Students</h1>
  <button
    onClick={() => setModal('add')}
    className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
  >
    + Add Student
  </button>
</div>
```

Replace with:

```jsx
<div className="flex items-center justify-between mb-4">
  <h1 className="text-xl font-bold">Students</h1>
  <div className="flex gap-2">
    <button
      onClick={handleExportCSV}
      className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50"
    >
      Export CSV
    </button>
    <button
      onClick={() => setModal('add')}
      className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
    >
      + Add Student
    </button>
  </div>
</div>
```

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev` from the `frontend/` directory) and open the Students page.

Verify:
1. The "Export CSV" button appears to the left of "+ Add Student"
2. Clicking it downloads a file named `students.csv`
3. Open the file in Excel — verify it opens correctly without garbled characters
4. Confirm columns: Name, Age Category, Skill Level, Parent Name, Parent Phone
5. Apply a filter or type in the search box, then export — confirm the CSV still contains **all** active students, not just the filtered view
6. If any adult students exist (no parent fields), confirm their rows export with empty strings in the Parent Name and Parent Phone columns

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/StudentsPage.jsx
git commit -m "feat: add Export CSV button to students page"
```
