import { useState } from 'react';

const AGE_CATEGORIES = ['U13', 'U15', 'U17', 'Adults', 'Mixed'];

export default function ScheduleForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    date:             initial.date             ?? '',
    time:             initial.time             ?? '',
    duration_minutes: initial.duration_minutes ?? 90,
    location:         initial.location         ?? '',
    age_category:     initial.age_category     ?? 'U13',
    fee:              initial.fee              ?? 20,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({ ...form, duration_minutes: Number(form.duration_minutes), fee: Number(form.fee) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (label, key, type = 'text', extraProps = {}) => (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        required
        {...extraProps}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {field('Date', 'date', 'date')}
      {field('Time', 'time', 'time')}
      {field('Duration (minutes)', 'duration_minutes', 'number', { min: 15, max: 300 })}
      {field('Location', 'location')}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Age Category</label>
        <select
          value={form.age_category}
          onChange={e => setForm(f => ({ ...f, age_category: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {AGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {field('Fee ($)', 'fee', 'number', { min: 0, step: '0.01' })}
      <div className="flex gap-2 mt-4">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
