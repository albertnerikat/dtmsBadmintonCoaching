import { useState } from 'react';

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

function isAdult(dateOfBirth) {
  if (!dateOfBirth) return false;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  return age > 16;
}

export default function StudentForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name:          initial.name          ?? '',
    date_of_birth: initial.date_of_birth ?? '',
    skill_level:   initial.skill_level   ?? 'Beginner',
    parent_name:   initial.parent_name   ?? '',
    parent_phone:  initial.parent_phone  ?? '',
    parent_email:  initial.parent_email  ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const adult = isAdult(form.date_of_birth);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (label, key, type = 'text', required = true) => (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">
        {label}{!required && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        required={required}
      />
    </div>
  );

  const contactPrefix = adult ? 'Self' : 'Parent';

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {field('Full Name', 'name')}
      {field('Date of Birth', 'date_of_birth', 'date')}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Skill Level</label>
        <select
          value={form.skill_level}
          onChange={e => setForm(f => ({ ...f, skill_level: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {SKILL_LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>
      {adult && (
        <p className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-2 mb-3">
          Adult student — contact details are optional and refer to the student themselves.
        </p>
      )}
      {field(`${contactPrefix} Name`, 'parent_name', 'text', !adult)}
      {field(`${contactPrefix} Phone`, 'parent_phone', 'tel', !adult)}
      {field(`${contactPrefix} Email`, 'parent_email', 'email', !adult)}
      <div className="flex gap-2 mt-4">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
