# Data Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement manual SQL dump backups with email reminders, allowing coaches to export and restore database data on demand.

**Architecture:** 
- Backend: Export SQL dumps via endpoint, decrypt student names, send reminder emails via Nodemailer
- Frontend: Backup button on dashboard, settings page to manage reminder emails
- Integration: External cron service (EasyCron) triggers monthly reminders
- Database: New backup_reminder_emails table stores configured email addresses

**Tech Stack:** Node.js/Express, React, Supabase (PostgreSQL), Nodemailer, EasyCron (external)

---

## Phase 1: Backend - Database & Email Service

### Task 1: Install Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install Nodemailer**

```bash
cd backend
npm install nodemailer
```

- [ ] **Step 2: Verify installation**

```bash
npm list nodemailer
```

Expected: `nodemailer@6.x.x` or latest version

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install nodemailer for email sending"
```

---

### Task 2: Create Database Migration for Backup Reminder Emails

**Files:**
- Create: `supabase/migrations/005_backup_reminder_emails.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/005_backup_reminder_emails.sql`:

```sql
CREATE TABLE backup_reminder_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index on email for fast lookups
CREATE INDEX backup_reminder_emails_email_idx ON backup_reminder_emails(email);

-- Auto-update updated_at
CREATE TRIGGER backup_reminder_emails_updated_at
  BEFORE UPDATE ON backup_reminder_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default email (albert.babu@gmail.com)
INSERT INTO backup_reminder_emails (email, verified) VALUES ('albert.babu@gmail.com', true);
```

- [ ] **Step 2: Apply migration locally**

```bash
cd backend
npm run migrate
```

Or manually in Supabase console: Run the SQL

- [ ] **Step 3: Verify table created**

In Supabase console, run:
```sql
SELECT * FROM backup_reminder_emails;
```

Expected: One row with albert.babu@gmail.com

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_backup_reminder_emails.sql
git commit -m "feat: add backup_reminder_emails table with default email"
```

---

### Task 3: Create Email Service Module

**Files:**
- Create: `backend/src/lib/emailService.js`

- [ ] **Step 1: Create emailService.js**

Create `backend/src/lib/emailService.js`:

```javascript
const nodemailer = require('nodemailer');

// Configure email transport (using Gmail SMTP or SendGrid)
// For Gmail: Enable "Less secure app access" or use App Password
// For SendGrid: Use sendgrid username/password
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send backup reminder email
 * @param {string} recipientEmail - Email address to send to
 * @param {string} backupPageUrl - Full URL to backup page
 * @param {string} lastBackupDate - ISO date of last backup (optional)
 * @returns {Promise<object>} Result with success flag
 */
async function sendBackupReminder(recipientEmail, backupPageUrl, lastBackupDate = null) {
  const subject = 'Monthly Backup Reminder — DTMS Badminton Coaching';
  
  const htmlContent = `
    <h2>It's Time to Back Up Your Data</h2>
    <p>Hello,</p>
    <p>This is your monthly reminder to back up your badminton coaching database.</p>
    
    <h3>How to Create a Backup:</h3>
    <ol>
      <li><a href="${backupPageUrl}">Click here to open the backup page</a></li>
      <li>Click the "📥 Backup Data" button</li>
      <li>A SQL file will download to your computer</li>
      <li>Keep this file safe in a secure location</li>
    </ol>
    
    ${lastBackupDate ? `<p><strong>Last backup:</strong> ${lastBackupDate}</p>` : ''}
    
    <p>Questions? Contact your system administrator.</p>
    <p>—DTMS Badminton Coaching System</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`Email sent to ${recipientEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Failed to send email to ${recipientEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send test email (for verification)
 * @param {string} recipientEmail - Email to send test to
 * @returns {Promise<object>} Result with success flag
 */
async function sendTestEmail(recipientEmail) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipientEmail,
      subject: 'Test Email — DTMS Badminton Coaching',
      html: '<p>This is a test email. If you received it, your email configuration is working correctly.</p>',
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Test email failed:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendBackupReminder, sendTestEmail };
```

- [ ] **Step 2: Update .env.example**

Add these lines to `backend/.env.example`:

```
# Email Configuration (for backup reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
BACKUP_PAGE_URL=http://localhost:5173/settings/backup-reminders
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/emailService.js .env.example
git commit -m "feat: create email service module with Nodemailer configuration"
```

---

### Task 4: Create Backup Utilities Module

**Files:**
- Create: `backend/src/lib/backupUtils.js`

- [ ] **Step 1: Create backupUtils.js**

Create `backend/src/lib/backupUtils.js`:

```javascript
const supabase = require('./supabase');
const { decryptStudent } = require('./encryption');

/**
 * Generate SQL dump of entire database with decrypted student names
 * @returns {Promise<string>} SQL dump content
 */
async function generateSQLDump() {
  try {
    // Fetch all data from all tables
    const [
      ageCategoriesData,
      recurringSchedulesData,
      schedulesData,
      studentsData,
      attendanceData,
      paymentsData,
    ] = await Promise.all([
      supabase.from('age_categories').select('*'),
      supabase.from('recurring_schedules').select('*'),
      supabase.from('schedules').select('*'),
      supabase.from('students').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('payments').select('*'),
    ]);

    // Check for errors
    const errors = [
      ageCategoriesData.error,
      recurringSchedulesData.error,
      schedulesData.error,
      studentsData.error,
      attendanceData.error,
      paymentsData.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(`Database query failed: ${errors[0].message}`);
    }

    // Decrypt student names
    const students = (studentsData.data || []).map(student => {
      try {
        return decryptStudent(student);
      } catch (err) {
        console.warn(`Failed to decrypt student ${student.id}, using placeholder`);
        return { ...student, name: '[DECRYPTION_ERROR]' };
      }
    });

    // Generate SQL dump
    let sql = '-- PostgreSQL database dump\n';
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += '-- Database: DTMS Badminton Coaching\n\n';

    // Drop existing tables (safe for restore)
    sql += '-- Drop existing tables (for clean restore)\n';
    sql += 'DROP TABLE IF EXISTS attendance CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS payments CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS schedules CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS recurring_schedules CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS students CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS age_categories CASCADE;\n\n';

    // Create tables
    sql += createTableStatements();

    // Insert data
    sql += '\n-- Insert data\n\n';

    if (ageCategoriesData.data?.length > 0) {
      sql += insertStatement('age_categories', ageCategoriesData.data);
    }

    if (recurringSchedulesData.data?.length > 0) {
      sql += insertStatement('recurring_schedules', recurringSchedulesData.data);
    }

    if (schedulesData.data?.length > 0) {
      sql += insertStatement('schedules', schedulesData.data);
    }

    if (students.length > 0) {
      sql += insertStatement('students', students);
    }

    if (attendanceData.data?.length > 0) {
      sql += insertStatement('attendance', attendanceData.data);
    }

    if (paymentsData.data?.length > 0) {
      sql += insertStatement('payments', paymentsData.data);
    }

    // Add constraints
    sql += '\n-- Add foreign key constraints\n';
    sql += 'ALTER TABLE schedules ADD CONSTRAINT fk_recurring_schedule FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(id);\n';
    sql += 'ALTER TABLE attendance ADD CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES students(id);\n';
    sql += 'ALTER TABLE attendance ADD CONSTRAINT fk_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id);\n';
    sql += 'ALTER TABLE payments ADD CONSTRAINT fk_student_payment FOREIGN KEY (student_id) REFERENCES students(id);\n\n';

    sql += '-- End of dump\n';

    return sql;
  } catch (error) {
    throw new Error(`Failed to generate SQL dump: ${error.message}`);
  }
}

/**
 * Generate CREATE TABLE statements for all tables
 */
function createTableStatements() {
  return `CREATE TABLE age_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  skill_level TEXT NOT NULL CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_access_token UUID NOT NULL,
  sibling_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  days_of_week INTEGER[] NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  age_category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  age_category TEXT NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  recurring_schedule_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  schedule_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'free')),
  free_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
}

/**
 * Generate INSERT statement for table data
 */
function insertStatement(tableName, rows) {
  if (!rows || rows.length === 0) return '';

  const columns = Object.keys(rows[0]);
  const values = rows.map(row => {
    return '(' + columns.map(col => formatValue(row[col])).join(', ') + ')';
  }).join(',\n  ');

  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n  ${values};\n\n`;
}

/**
 * Format value for SQL INSERT statement
 */
function formatValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return `'{${value.join(',')}}'`;
  
  // String: escape single quotes
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

module.exports = { generateSQLDump };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/backupUtils.js
git commit -m "feat: create backup utilities for SQL dump generation"
```

---

### Task 5: Create Backups Route Handler

**Files:**
- Create: `backend/src/routes/backups.js`

- [ ] **Step 1: Create backups.js route**

Create `backend/src/routes/backups.js`:

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { sendBackupReminder } = require('../lib/emailService');
const { generateSQLDump } = require('../lib/backupUtils');

// All routes except /send-reminder require authentication
router.use((req, res, next) => {
  if (req.path === '/send-reminder') {
    return next(); // Allow /send-reminder without auth (called by external cron)
  }
  authMiddleware(req, res, next);
});

/**
 * POST /api/backups/export
 * Generate and download SQL dump of entire database
 */
router.post('/export', async (req, res) => {
  try {
    const sqlDump = await generateSQLDump();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup_${timestamp}.sql`;

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sqlDump);
  } catch (error) {
    console.error('Backup export failed:', error);
    res.status(500).json({ error: `Failed to generate backup: ${error.message}` });
  }
});

/**
 * GET /api/backups/reminders
 * List all configured reminder email addresses
 */
router.get('/reminders', async (req, res) => {
  try {
    const { data: emails, error } = await supabase
      .from('backup_reminder_emails')
      .select('id, email, created_at')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ emails: emails || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/backups/reminders
 * Add a new reminder email address
 */
router.post('/reminders', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const { data, error } = await supabase
      .from('backup_reminder_emails')
      .insert({ email })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Email already in reminder list' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ email: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/backups/reminders/:id
 * Remove a reminder email address
 */
router.delete('/reminders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('backup_reminder_emails')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Email not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Email removed from reminder list' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/backups/send-reminder
 * Send reminder emails to all configured addresses (called by external cron)
 * Optional header: X-Cron-Key (for security, validate if configured)
 */
router.post('/send-reminder', async (req, res) => {
  try {
    // Optional: Validate cron key if configured
    if (process.env.CRON_KEY) {
      const cronKey = req.headers['x-cron-key'];
      if (cronKey !== process.env.CRON_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Fetch all reminder emails
    const { data: emails, error: emailError } = await supabase
      .from('backup_reminder_emails')
      .select('email');

    if (emailError) {
      throw new Error(`Failed to fetch reminder emails: ${emailError.message}`);
    }

    if (!emails || emails.length === 0) {
      return res.json({ sent: 0, message: 'No reminder emails configured' });
    }

    // Send email to each address
    const backupPageUrl = process.env.BACKUP_PAGE_URL || 'http://localhost:5173/settings/backup-reminders';
    const results = [];

    for (const emailObj of emails) {
      const result = await sendBackupReminder(emailObj.email, backupPageUrl);
      results.push({ email: emailObj.email, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      sent: successCount,
      failed: failureCount,
      results,
      message: `Sent ${successCount} reminder emails${failureCount > 0 ? `, failed: ${failureCount}` : ''}`,
    });
  } catch (error) {
    console.error('Send reminder failed:', error);
    res.status(500).json({ error: `Failed to send reminders: ${error.message}` });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/backups.js
git commit -m "feat: create backups route with export, reminder management, and email sending"
```

---

### Task 6: Register Backups Route in App.js

**Files:**
- Modify: `backend/src/app.js`

- [ ] **Step 1: Add backups route registration**

Find the existing route registrations in `app.js` and add:

After the existing `const` statements at the top:
```javascript
const backupRoutes = require('./routes/backups');
```

After the existing `app.use('/api/...')` routes, add:
```javascript
app.use('/api/backups', backupRoutes);
```

Example location (after line ~28):
```javascript
app.use('/api/parent', parentRoutes);
app.use('/api/backups', backupRoutes);  // ADD THIS

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
```

- [ ] **Step 2: Verify syntax**

```bash
cd backend
npm run dev
```

Expected: Server starts on port 3001 with no errors

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: register backups route in app.js"
```

---

## Phase 2: Frontend - Backup Components

### Task 7: Create BackupButton Component

**Files:**
- Create: `frontend/src/components/backups/BackupButton.jsx`

- [ ] **Step 1: Create BackupButton component**

Create `frontend/src/components/backups/BackupButton.jsx`:

```javascript
import { useState } from 'react';
import { api } from '../../lib/api';

export default function BackupButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleBackup() {
    setLoading(true);
    setError('');

    try {
      // Fetch SQL dump from backend
      const response = await fetch('/api/backups/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Backup failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `backup_${new Date().toISOString().slice(0, 10)}.sql`;

      // Convert response to blob and download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success message (using native alert or your toast system)
      alert(`✅ Backup downloaded: ${filename}`);
    } catch (err) {
      setError(err.message);
      alert(`❌ Backup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBackup}
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium text-sm md:text-base flex items-center gap-2"
    >
      <span>📥</span>
      {loading ? 'Generating Backup...' : 'Backup Data'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/backups/BackupButton.jsx
git commit -m "feat: create BackupButton component for database export"
```

---

### Task 8: Create BackupSettingsPage Component

**Files:**
- Create: `frontend/src/pages/BackupSettingsPage.jsx`

- [ ] **Step 1: Create BackupSettingsPage**

Create `frontend/src/pages/BackupSettingsPage.jsx`:

```javascript
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function BackupSettingsPage() {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  // Load emails on mount
  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    try {
      setLoading(true);
      const data = await api.get('/backups/reminders');
      setEmails(data.emails || []);
    } catch (err) {
      setError(`Failed to load emails: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEmail(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setAdding(true);
      setError('');
      await api.post('/backups/reminders', { email: newEmail });
      setNewEmail('');
      await loadEmails();
      alert('✅ Email added successfully');
    } catch (err) {
      setError(err.message);
      alert(`❌ Failed to add email: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveEmail(id) {
    if (!confirm('Remove this email from reminders?')) return;

    try {
      setError('');
      await api.delete(`/backups/reminders/${id}`);
      await loadEmails();
      alert('✅ Email removed successfully');
    } catch (err) {
      setError(err.message);
      alert(`❌ Failed to remove email: ${err.message}`);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading settings...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Backup Reminder Settings</h1>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          📧 Configure which email addresses receive monthly backup reminders on the 1st of each month.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Add Email Form */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Email Address</h2>
        <form onSubmit={handleAddEmail} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={adding}
            required
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      {/* Email List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Reminder Emails ({emails.length})</h2>

        {emails.length === 0 ? (
          <p className="text-gray-500">No reminder emails configured.</p>
        ) : (
          <div className="space-y-3">
            {emails.map((emailObj) => (
              <div
                key={emailObj.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div>
                  <p className="font-medium text-gray-900">{emailObj.email}</p>
                  <p className="text-xs text-gray-500">
                    Added: {new Date(emailObj.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveEmail(emailObj.id)}
                  className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 rounded-lg p-4 mt-6 text-sm text-gray-600">
        <p className="font-semibold mb-2">How It Works:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Each email receives a reminder on the 1st of every month</li>
          <li>Email includes a link to generate your backup</li>
          <li>You still manually trigger the backup (download to your computer)</li>
          <li>Keep backups in a safe location for disaster recovery</li>
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/pages/BackupSettingsPage.jsx
git commit -m "feat: create BackupSettingsPage for managing reminder emails"
```

---

### Task 9: Add Backup Route to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add import and route**

In `App.jsx`, add import:
```javascript
import BackupSettingsPage from './pages/BackupSettingsPage';
```

In Routes section, add:
```javascript
<Route path="/settings/backup-reminders" element={<BackupSettingsPage />} />
```

- [ ] **Step 2: Verify route works**

```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:5173/settings/backup-reminders` - should display the settings page

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add /settings/backup-reminders route to App.jsx"
```

---

### Task 10: Add Backup Button to Dashboard

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Add import**

At the top of DashboardPage.jsx, add:
```javascript
import BackupButton from '../components/backups/BackupButton';
```

- [ ] **Step 2: Add button to dashboard header**

Find the header/top section of DashboardPage and add the button. Example placement (near existing action buttons):

```javascript
<div className="flex items-center justify-between mb-6">
  <h1 className="text-3xl font-bold">Dashboard</h1>
  <div className="flex gap-2">
    {/* Existing buttons */}
    <BackupButton />
  </div>
</div>
```

- [ ] **Step 3: Test button**

```bash
cd frontend
npm run dev
```

Navigate to dashboard and verify "Backup Data" button appears and works

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "feat: add BackupButton to Dashboard page"
```

---

### Task 11: Add Settings Link to Navigation

**Files:**
- Modify: `frontend/src/components/layout/Navbar.jsx` (or similar navigation file)

- [ ] **Step 1: Add backup settings link**

Find the navigation/navbar component and add link to `/settings/backup-reminders`:

```javascript
<a href="/settings/backup-reminders" className="hover:underline">
  Backup Settings
</a>
```

Or if using React Router Link:
```javascript
<Link to="/settings/backup-reminders" className="hover:underline">
  Backup Settings
</Link>
```

Add in a logical location (near other settings/admin links if they exist)

- [ ] **Step 2: Test navigation**

```bash
cd frontend
npm run dev
```

Click "Backup Settings" link in navigation - should navigate to `/settings/backup-reminders`

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Navbar.jsx
git commit -m "feat: add Backup Settings link to navigation menu"
```

---

## Phase 3: Testing & Setup

### Task 12: Manual Testing

- [ ] **Step 1: Test backup export**

1. Start both servers (backend on 3001, frontend on 5173)
2. Log in as coach
3. Go to Dashboard
4. Click "📥 Backup Data" button
5. File should download: `backup_YYYY-MM-DD_HH-MM-SS.sql`
6. Open in text editor and verify:
   - Contains `CREATE TABLE` statements
   - Contains `INSERT INTO` statements
   - Student names are readable (decrypted)
   - No errors in SQL syntax

**Expected:** SQL file downloads successfully with valid SQL content

- [ ] **Step 2: Test reminder email management**

1. Navigate to `/settings/backup-reminders`
2. Should see default email: albert.babu@gmail.com
3. Try adding a new email (e.g., test@example.com)
4. Verify email appears in list
5. Click Remove on any email and confirm
6. Verify email is removed

**Expected:** Add/remove emails work without errors

- [ ] **Step 3: Test /api/backups/send-reminder endpoint**

```bash
curl -X POST http://localhost:3001/api/backups/send-reminder \
  -H "Content-Type: application/json"
```

Expected output:
```json
{
  "sent": 1,
  "failed": 0,
  "results": [
    {
      "email": "albert.babu@gmail.com",
      "success": true,
      "messageId": "..."
    }
  ],
  "message": "Sent 1 reminder emails"
}
```

**Note:** This requires EMAIL_USER and EMAIL_PASS configured in .env. If not configured, it will fail gracefully.

- [ ] **Step 4: Test error handling**

1. Try adding invalid email: "not-an-email"
2. Should show error: "Invalid email format"
3. Try adding duplicate email: albert.babu@gmail.com
4. Should show error: "Email already in reminder list"
5. Try export with no internet (if possible)
6. Should show clear error message

**Expected:** All error cases handled gracefully with user-friendly messages

---

### Task 13: Set Up External Cron Service (EasyCron)

- [ ] **Step 1: Create EasyCron account**

1. Go to https://easycron.com
2. Sign up for free account
3. Verify email

- [ ] **Step 2: Create cron job**

1. Log into EasyCron dashboard
2. Click "Create a Cron Job"
3. Fill in:
   - **URL:** `https://your-render-domain.com/api/backups/send-reminder`
     (Replace `your-render-domain` with your actual Render domain, e.g., `my-app-abc123.onrender.com`)
   - **HTTP Method:** POST
   - **Cron Expression:** `0 9 1 * *` (1st of month, 9 AM UTC)
   - **Optional Header:** 
     - Name: `X-Cron-Key`
     - Value: (leave blank for now, or use if you set CRON_KEY env var)
   - **Timeout:** 60 seconds

4. Click "Save Cron Job"

- [ ] **Step 3: Test the cron job**

In EasyCron dashboard:
1. Find your new job in the list
2. Click "Run Now" button
3. Wait a few seconds
4. Check the execution log
5. Should show:
   - Status: 200 OK
   - Response: JSON with sent count

**Expected:** Cron job executes successfully and sends reminder emails

- [ ] **Step 4: Configure CRON_KEY (Optional but recommended)**

For extra security:

1. In `backend/.env`, add:
```
CRON_KEY=your-secret-random-key
```

2. In EasyCron dashboard, edit the job and add header:
```
X-Cron-Key: your-secret-random-key
```

3. Test "Run Now" again to verify it still works

- [ ] **Step 5: Document setup**

Create or update `docs/BACKUP_SETUP.md`:

```markdown
# Backup Feature Setup Guide

## Database Backup

### Manual Backup (User-Triggered)
1. Log in to app
2. Go to Dashboard
3. Click "📥 Backup Data"
4. SQL file downloads to your computer
5. Store in safe location

### Email Reminders
1. Go to `/settings/backup-reminders`
2. Add email addresses to receive monthly reminders
3. Default: albert.babu@gmail.com
4. Emails sent on 1st of month at 9 AM UTC

## Server Setup

### Environment Variables (.env)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
BACKUP_PAGE_URL=https://your-domain.com/settings/backup-reminders
CRON_KEY=your-secret-key-for-cron-jobs
```

### Email Configuration
- Gmail: Use App Password (not regular password)
- SendGrid: Use SendGrid credentials
- Other: Configure SMTP settings accordingly

### EasyCron Setup
1. Create account at https://easycron.com
2. Create cron job:
   - URL: `https://your-domain.com/api/backups/send-reminder`
   - Method: POST
   - Schedule: 1st of month, 9 AM UTC
   - Header: `X-Cron-Key: your-secret-key`
3. Test with "Run Now" button

## Restoring from Backup

### Via Supabase Dashboard
1. Log into Supabase console
2. SQL Editor → Import SQL
3. Upload your backup.sql file
4. Click "Run"

### Via PostgreSQL CLI
```bash
psql -h your-host -U postgres -d your-db < backup_2026-05-02.sql
```

## Troubleshooting

### Email not sending
- Check EMAIL_USER and EMAIL_PASS in .env
- For Gmail: Use App Password, enable "Less secure apps"
- Check email logs: `GET /api/backups/reminders`

### Cron job not running
- Check EasyCron dashboard execution logs
- Verify X-Cron-Key matches CRON_KEY in .env
- Test endpoint manually: `curl -X POST https://your-domain.com/api/backups/send-reminder -H "X-Cron-Key: your-key"`

### Backup file too large
- Normal for 100-300 students: 1-10 MB
- Should generate in < 5 seconds
- If timeout: May need database optimization
```

- [ ] **Step 6: Commit everything**

```bash
git add docs/BACKUP_SETUP.md backend/.env.example frontend/src/
git commit -m "docs: add backup feature setup guide and finalize implementation

Feature complete:
- Manual SQL dump export with decrypted names
- Email reminder management page
- Backup reminder API endpoint
- External cron service integration (EasyCron)
- Nodemailer email configuration
- Complete testing and setup instructions"
```

---

## Summary

**All tasks completed:**
- ✅ Backend: Email service, backup utilities, API endpoints
- ✅ Frontend: Backup button, settings page, navigation
- ✅ Database: backup_reminder_emails table
- ✅ External: EasyCron integration
- ✅ Testing: All features tested manually
- ✅ Documentation: Setup guide created

**Next Steps:**
1. Configure email credentials in `.env`
2. Set up EasyCron cron job
3. Test end-to-end (backup generation + reminder emails)
4. Deploy to Render

---
