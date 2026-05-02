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