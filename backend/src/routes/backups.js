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