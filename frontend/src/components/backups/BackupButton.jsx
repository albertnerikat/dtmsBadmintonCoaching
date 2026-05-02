import { useState } from 'react';
import { api } from '../../lib/api';

export default function BackupButton() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleBackup() {
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      // Fetch the backup file from the API
      const response = await fetch('/api/backups/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(body.error || 'Backup failed');
      }

      // Get the blob data
      const blob = await response.blob();

      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.download = `backup_${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleBackup}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Exporting...' : 'Export Backup'}
      </button>
      {success && (
        <span className="text-green-600 text-sm font-medium">
          ✓ Backup downloaded
        </span>
      )}
      {error && (
        <span className="text-red-600 text-sm font-medium">
          Error: {error}
        </span>
      )}
    </div>
  );
}