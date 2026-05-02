# Data Backup Feature Design

**Date:** 2026-05-02  
**Status:** Design Phase

---

## 1. Overview

A manual, on-demand data backup feature that allows coaches to export the entire Supabase database as a SQL dump file. The backup includes all data with decrypted student names for readability, making it suitable for disaster recovery, audit/analysis, and local archival.

Users trigger backups manually via a button in the UI, download the SQL file to their local machine, and can restore it anytime using Supabase tools or standard PostgreSQL tools.

**Monthly Email Reminders:** Configured email addresses receive monthly reminders to generate and store backups. Coaches can add/remove email addresses for reminders via a settings page.

---

## 2. Requirements

### 2.1 Functional Requirements

**Backup Generation:**
- Endpoint: `POST /api/backups/export`
- Fetch all data from all 6 tables
- Decrypt student names during export (for readability)
- Generate valid PostgreSQL SQL dump file
- Return file as downloadable attachment
- Filename format: `backup_YYYY-MM-DD_HH-MM-SS.sql`

**Backup Button/UI:**
- Add "Backup Data" button to Dashboard or main navigation
- Click to trigger backup export
- Show loading state while file generates
- Browser automatically downloads SQL file
- Success message after download
- Error handling if export fails

**Monthly Email Reminders:**
- External cron service (EasyCron.com - free tier) pings `/api/backups/send-reminder` monthly
- Cron trigger: 1st of each month at 9:00 AM
- Backend endpoint sends email to all configured reminder email addresses
- Email subject: "Monthly Backup Reminder — DTMS Badminton Coaching"
- Email body includes:
  - Link to backup page with one-click access
  - Quick 2-step instructions on how to generate backup
  - Last backup date (if available in database)
- Emails sent via Nodemailer (free tier SMTP or SendGrid - free tier available)

**Reminder Email Management:**
- New settings page: `/settings/backup-reminders`
- Shows list of email addresses receiving reminders
- Input field to add new email (validated format)
- Delete button next to each email
- Confirm before deleting
- Default: albert.babu@gmail.com (can be removed/changed)
- Supports multiple emails

**What Gets Backed Up:**
- All 6 tables: students, schedules, attendance, recurring_schedules, payments, age_categories
- All columns and rows
- All data relationships and constraints
- Student names decrypted (readable format)
- Ready for direct import into Supabase

### 2.2 Non-Functional Requirements

**Performance:**
- Backup generation: < 5 seconds for typical database (100-300 students)
- File size: Reasonable for typical data (likely 1-10 MB)
- Does not block other API requests (async/non-blocking)

**Security:**
- Requires authentication (coach only, via authMiddleware)
- Decrypted names only exist in RAM during generation (not logged/stored)
- File sent directly to user (no intermediate storage on server)
- Uses service role key for Supabase access (full permissions needed)

**Reliability:**
- Handles missing/null data gracefully
- If student name decryption fails: Use placeholder "[DECRYPTION_ERROR]"
- Clear error messages if export fails
- No partial downloads (complete file or error)

**Compatibility:**
- SQL dump format compatible with:
  - Supabase native restore
  - PostgreSQL CLI (psql)
  - Any PostgreSQL-compatible database

---

## 3. Data Model

### 3.1 Tables to Back Up

All 6 tables with all columns:

1. **students**
   - id, name (will be decrypted), date_of_birth, skill_level, parent_name, parent_phone, parent_email, parent_access_token, sibling_ids, status, created_at, updated_at

2. **recurring_schedules**
   - id, days_of_week, time, location, fee, age_category, created_at, updated_at

3. **schedules**
   - id, date, time, location, age_category, fee, recurring_schedule_id, created_at, updated_at

4. **attendance**
   - id, student_id, schedule_id, status, free_reason, checked_in_at, created_at

5. **payments**
   - id, student_id, amount, payment_date, notes, created_at

6. **age_categories**
   - id, category_name, created_at (if this table exists)

7. **backup_reminder_emails** (NEW TABLE)
   - id (UUID primary key)
   - email (TEXT, unique, required) — Email address to receive monthly reminders
   - created_at (TIMESTAMPTZ) — When email was added
   - verified (BOOLEAN, default false) — Email verification status (optional for v1)

### 3.2 Decryption During Backup

**Student names are encrypted** — during backup, decrypt them:
- Use existing `decryptStudent()` function from `backend/src/lib/encryption.js`
- Apply to all student records
- If decryption fails for any student: Use placeholder and log warning
- Result: SQL file contains readable names, safe to store locally

---

## 4. API Specification

### 4.1 New Endpoint: POST /api/backups/export

**Purpose:** Generate and return SQL dump of entire database

**Request:**
```
POST /api/backups/export
Headers: Authorization: Bearer <JWT_TOKEN>
Body: (empty or optional params)
```

**Response (Success):**
- HTTP 200
- Content-Type: application/sql
- Content-Disposition: attachment; filename="backup_2026-05-02_14-30-45.sql"
- Body: SQL dump file (text)

**Response (Error):**
```json
{
  "error": "Failed to generate backup: [reason]"
}
```

HTTP 400, 401, 500 depending on error type

### 4.2 SQL Dump Format

Generated file structure:
```sql
-- PostgreSQL database dump
-- Host: supabase
-- Database: your-db
-- Generated: 2026-05-02 14:30:45

-- Drop existing tables (optional, for clean restore)
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS recurring_schedules CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS age_categories CASCADE;

-- Create tables with schema
CREATE TABLE age_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,  -- DECRYPTED
  date_of_birth DATE NOT NULL,
  ...
);

-- Insert data
INSERT INTO age_categories (id, category_name, created_at) VALUES
  ('uuid-1', 'U9', '2026-01-01 00:00:00+00'),
  ...;

INSERT INTO students (id, name, date_of_birth, ...) VALUES
  ('uuid-1', 'John Doe', '2015-03-10', ...),  -- NAME DECRYPTED
  ...;

-- Foreign key constraints
ALTER TABLE schedules ADD CONSTRAINT fk_recurring_schedule
  FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(id);

ALTER TABLE attendance ADD CONSTRAINT fk_student
  FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE payments ADD CONSTRAINT fk_student
  FOREIGN KEY (student_id) REFERENCES students(id);
```

### 4.3 External Cron Service Integration

**Service:** EasyCron.com (free tier)

**Setup Steps (one-time):**
1. Sign up at https://easycron.com
2. Create new cron job
3. URL: `https://your-render-domain.com/api/backups/send-reminder`
4. Method: POST
5. Schedule: Monthly, 1st of month, 09:00 AM UTC
6. Optional: Add header `X-Cron-Key: your-secret-key` for security
7. Enable job

**How it works:**
- EasyCron calls your backend endpoint monthly
- Endpoint queries database for all reminder emails
- Nodemailer sends email to each address
- Logs success/failure
- Returns 200 OK

**Alternative Cron Services:**
- cron-job.org (also free)
- SchedulerService.com
- Or any HTTP-based cron service

---

## 5. UI/UX Design

### 5.1 Backup Button Location

**Dashboard Page** (recommended):
- Add button in top-right corner of dashboard
- Text: "📥 Backup Data" or "⬇️ Export Database"
- Styling: Secondary button (gray background, blue hover)
- Below or near existing action buttons

Alternative locations:
- Settings/Admin page
- Navigation menu (if space allows)

### 5.2 User Interaction Flow

```
1. User clicks "Backup Data" button
2. Button shows loading state (disabled, spinner)
3. API generates backup file (< 5 seconds)
4. File automatically downloads to user's Downloads folder
5. Button returns to normal state
6. Toast/notification: "✅ Backup downloaded: backup_2026-05-02_14-30-45.sql"
7. User can download again anytime
```

### 5.3 Error Handling

If export fails:
```
Button shows loading state
After timeout/error from API:
Toast shows: "❌ Backup failed: [error message]"
Button returns to normal
User can retry
```

---

## 6. Implementation Scope

### 6.1 Backend

**New files:**
- `backend/src/routes/backups.js` — Backup and reminder email routes
- `backend/src/lib/backupUtils.js` — SQL dump generation logic
- `backend/src/lib/emailService.js` — Email sending via Nodemailer

**Changes:**
- `backend/src/app.js` — Add backups route
- `backend/package.json` — Add nodemailer library
- `.env.example` — Add EMAIL_USER, EMAIL_PASS, SMTP_HOST (for email service)

**Logic to implement:**

*Backup Export (POST /api/backups/export):*
- Fetch all data from all 6 tables via Supabase
- Decrypt student names using existing encryption library
- Format as valid PostgreSQL SQL dump
- Generate filename with timestamp
- Return as file attachment
- Error handling for database queries, decryption failures

*Send Reminder Emails (POST /api/backups/send-reminder):*
- Called by external cron service (EasyCron) monthly
- Query all emails from backup_reminder_emails table
- Send reminder email to each address
- Email body includes:
  - App link to backup page
  - Step-by-step instructions
  - Last backup date (if available)
- Log email send success/failure
- Handle email service errors gracefully
- Return 200 OK on success

*Reminder Email Management:*
- GET /api/backups/reminders — List configured emails (requires auth)
- POST /api/backups/reminders — Add new email (requires auth)
- DELETE /api/backups/reminders/:id — Remove email (requires auth)
- All require authentication except /send-reminder (which needs basic auth or API key)

**External Cron Setup:**
- Create account at EasyCron.com (free tier)
- Create cron job: POST to `https://your-render-domain.com/api/backups/send-reminder`
- Schedule: Monthly, 1st at 9:00 AM
- Auth: Use optional API key header for security

### 6.2 Frontend

**New files:**
- `frontend/src/components/backups/BackupButton.jsx` — Backup trigger button
- `frontend/src/pages/BackupSettingsPage.jsx` — Email reminder management page

**Changes:**
- `frontend/src/pages/DashboardPage.jsx` — Add backup button
- `frontend/src/App.jsx` — Add route for `/settings/backup-reminders`
- `frontend/src/components/layout/Navbar.jsx` — Add settings link (if not already present)

**Logic to implement:**

*Backup Button:*
- Button with loading state
- API call to POST /api/backups/export
- Handle response and trigger download
- Show success/error toast
- User-friendly error messages

*Backup Settings Page:*
- Fetch list of reminder emails from GET /api/backups/reminders
- Display emails in a list with delete buttons
- Input field to add new email
- Form validation (valid email format)
- Add button makes POST to /api/backups/reminders
- Delete button makes DELETE to /api/backups/reminders/:id with confirmation
- Show success/error messages for add/delete actions
- Default email (albert.babu@gmail.com) shown with note

**Libraries to use:**
- Built-in fetch API for download handling
- Existing toast/notification system (already in app)
- Email validation regex or library

### 6.3 Database

No schema changes required.

---

## 7. Restoration Instructions (User-Facing)

When user needs to restore from backup:

### Via Supabase Dashboard (Easiest):
```
1. Log into Supabase console
2. Go to SQL Editor
3. Click "New Query" → "Import SQL"
4. Upload your backup.sql file
5. Click "Run"
6. Database restored
```

### Via Supabase CLI:
```bash
supabase db push --dry-run < backup_2026-05-02_14-30-45.sql
```

### Via PostgreSQL CLI (if hosting elsewhere):
```bash
psql -h your-host -U postgres -d your-db < backup_2026-05-02_14-30-45.sql
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Backend:**
- `backups.test.js`:
  - Verify endpoint returns valid SQL
  - Verify all tables are included
  - Verify student names are decrypted
  - Verify error handling (missing data, decryption failure)

### 8.2 Integration Tests

- Generate backup, download file
- Verify file content is valid SQL
- Test on actual Supabase instance
- Verify file size is reasonable

### 8.3 Manual Testing

- Click backup button, wait for download
- Open downloaded .sql file in editor
- Verify student names are readable (not encrypted)
- Verify all tables present (students, schedules, attendance, etc.)
- Optional: Restore to test Supabase project and verify data integrity

---

## 9. Error Scenarios & Handling

| Scenario | Handling |
|----------|----------|
| User not authenticated | Return 401, show "Please log in" |
| Supabase connection fails | Return 500, show "Database connection error" |
| Decryption fails for one student | Use placeholder, continue with other students, log warning |
| All decryptions fail | Return 500, show "Decryption error" |
| Too much data / timeout | Return 500, show "Export too large, try smaller date range" (or split) |
| Browser doesn't support download | Show error, offer copy-paste of SQL text |

---

## 10. Future Enhancements (Out of Scope)

- Automated scheduled backups (monthly cron job)
- Cloud storage integration (Google Drive, S3)
- Incremental backups (only changes since last backup)
- Selective backup (choose which tables to include)
- Backup history/versioning
- Restore via UI (with preview and confirmation)

---

## 11. Success Criteria

**Backup Export:**
✅ Backup button accessible and easy to find  
✅ SQL file downloads in < 5 seconds  
✅ File is valid SQL (can be imported to Supabase)  
✅ Student names decrypted in file (readable)  
✅ All 6 tables included with all data  
✅ Filename includes timestamp (YYYY-MM-DD_HH-MM-SS)  
✅ Error messages clear if export fails  
✅ Authentication required (coach only)  
✅ No sensitive data logged/stored on server  
✅ Restoration instructions provided to user  

**Email Reminders:**
✅ Default email (albert.babu@gmail.com) added to system  
✅ Reminder endpoint `/api/backups/send-reminder` works and sends emails  
✅ External cron service (EasyCron) configured to call endpoint monthly  
✅ Email includes link to backup page and clear instructions  
✅ Settings page accessible at `/settings/backup-reminders`  
✅ Can add new reminder emails via form  
✅ Can remove reminder emails with confirmation  
✅ Email validation prevents invalid formats  
✅ Email send failures logged but don't break app  
✅ External cron service triggers reliably on 1st of month  
✅ User sees success/error messages for email management actions  

---
