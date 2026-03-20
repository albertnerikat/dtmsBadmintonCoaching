import { useState } from 'react';

export default function PaymentForm({ studentId, onSubmit, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amount: '', payment_date: today, notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        student_id: studentId,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        notes: form.notes || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Amount ($)</label>
        <input
          type="number" min="0.01" step="0.01" required
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. 80"
        />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Payment Date</label>
        <input
          type="date" required
          value={form.payment_date}
          onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Notes (optional)</label>
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. March payment"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Record Payment'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
