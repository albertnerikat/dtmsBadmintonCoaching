import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function BackupSettingsPage() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Load reminder emails on mount
  useEffect(() => {
    loadReminders();
  }, []);

  async function loadReminders() {
    setLoading(true);
    try {
      const data = await api.get('/backups/reminders');
      setReminders(data.emails || []);
      setError('');
    } catch (err) {
      setError('Failed to load reminder emails: ' + err.message);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }

  // Validate email format
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleAddEmail(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate
    if (!newEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!isValidEmail(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    const emailExists = reminders.some(r => r.email === newEmail);
    if (emailExists) {
      setError('Email already in reminder list');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post('/backups/reminders', { email: newEmail });
      setReminders([...reminders, result.email]);
      setNewEmail('');
      setSuccess('Email added successfully');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEmail(id, email) {
    // Confirm deletion
    if (!window.confirm(`Remove ${email} from backup reminders?`)) {
      return;
    }

    setDeleting(id);
    try {
      await api.delete(`/backups/reminders/${id}`);
      setReminders(reminders.filter(r => r.id !== id));
      setError('');
      setSuccess('Email removed successfully');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Failed to remove email: ' + err.message);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading backup settings...</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Backup Settings</h1>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h2 className="font-semibold text-blue-900 mb-2">About Backup Reminders</h2>
        <p className="text-sm text-blue-800 mb-2">
          Backup reminders help ensure your database is regularly backed up. When a reminder is scheduled, an email will be sent to the specified address as a notification and reminder to download a backup.
        </p>
        <p className="text-sm text-blue-800">
          You can export backups anytime from the Dashboard using the "Export Backup" button. Add multiple email addresses to distribute reminders to your team.
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Add Email Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add Reminder Email</h2>
        <form onSubmit={handleAddEmail} className="flex gap-2">
          <input
            type="email"
            placeholder="your@email.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Email'}
          </button>
        </form>
      </div>

      {/* Reminder List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Current Reminders</h2>
        {reminders.length === 0 ? (
          <p className="text-gray-500 text-sm">No reminder emails configured yet.</p>
        ) : (
          <div className="space-y-2">
            {reminders.map(reminder => (
              <div key={reminder.id} className="flex items-center justify-between bg-gray-50 rounded px-4 py-3 border border-gray-200">
                <span className="text-sm">{reminder.email}</span>
                <button
                  onClick={() => handleDeleteEmail(reminder.id, reminder.email)}
                  disabled={deleting === reminder.id}
                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {deleting === reminder.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}