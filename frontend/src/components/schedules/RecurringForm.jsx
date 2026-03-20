import { useState } from 'react';

const AGE_CATEGORIES = ['U13', 'U15', 'U17', 'Adults', 'Mixed'];
const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export default function RecurringForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    days_of_week: [],
    time: '',
    duration_minutes: 90,
    location: '',
    age_category: 'U13',
    fee: 20,
    start_date: '',
    end_date: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleDay(value) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(value)
        ? f.days_of_week.filter(d => d !== value)
        : [...f.days_of_week, value].sort(),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.days_of_week.length === 0) {
      setError('Select at least one day of the week');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        duration_minutes: Number(form.duration_minutes),
        fee: Number(form.fee),
        end_date: form.end_date || undefined,
      });
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
        required={key !== 'end_date'}
        {...extraProps}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="mb-3">
        <label className="block text-sm font-medium mb-2">Days of Week</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`px-3 py-1.5 rounded text-sm border ${
                form.days_of_week.includes(d.value)
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {field('Start Date', 'start_date', 'date')}
      {field('End Date (optional)', 'end_date', 'date')}
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
          {loading ? 'Creating...' : 'Create Series'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
