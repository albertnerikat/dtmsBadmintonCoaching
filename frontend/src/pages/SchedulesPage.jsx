import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import ScheduleList from '../components/schedules/ScheduleList';
import ScheduleForm from '../components/schedules/ScheduleForm';
import RecurringForm from '../components/schedules/RecurringForm';

const STATUS_FILTERS = ['All', 'scheduled', 'cancelled'];
const DAY_FILTERS = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_FILTERS = ['All', 'Upcoming', 'Past'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CancelModal({ schedule, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(schedule.id, reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-sm text-gray-600 mb-3">
        Cancel session on <strong>{schedule.date}</strong> at <strong>{schedule.time?.slice(0, 5)}</strong>?
      </p>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Reason (optional)</label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. Coach unavailable"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Cancelling...' : 'Cancel Session'}
        </button>
        <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Keep
        </button>
      </div>
    </form>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [statusFilter, setStatusFilter] = useState('scheduled');
  const [dayFilter, setDayFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('All');
  const [modal, setModal] = useState(null); // null | 'add' | { cancel: schedule }
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSchedules(); }, [statusFilter, dayFilter, timeFilter]);

  function getLocalDateString(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function loadSchedules() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (dayFilter !== 'All') params.append('day', dayFilter);
      
      if (timeFilter === 'Upcoming') {
        params.append('date_from', getLocalDateString(new Date()));
      } else if (timeFilter === 'Past') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        params.append('date_to', getLocalDateString(yesterday));
      }

      const queryStr = params.toString();
      const query = queryStr ? `/schedules?${queryStr}` : '/schedules';
      const data = await api.get(query);
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(form) {
    await api.post('/schedules', form);
    await loadSchedules();
    setModal(null);
  }

  async function handleCancel(id, reason) {
    try {
      await api.post(`/schedules/${id}/cancel`, { reason });
      await loadSchedules();
      setModal(null);
    } catch (err) {
      alert(err.message || 'Failed to cancel session.');
    }
  }

  async function handleDeleteOld() {
    if (!window.confirm('Permanently delete all sessions older than 1 year? This cannot be undone.')) return;
    try {
      const result = await api.delete('/schedules/old');
      await loadSchedules();
      alert(`Deleted ${result.deleted} session(s).`);
    } catch (err) {
      alert(err.message || 'Failed to delete old sessions.');
    }
  }

  async function handleAddRecurring(form) {
    const result = await api.post('/recurring', form);
    await loadSchedules();
    setModal(null);
    alert(`Created ${result.sessions_created} session(s) in the series.`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Schedules</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('add')}
            className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
          >
            + One-off Session
          </button>
          <button
            onClick={() => setModal('recurring')}
            className="border border-blue-700 text-blue-700 px-4 py-2 rounded text-sm hover:bg-blue-50"
          >
            + Recurring Series
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded text-sm border capitalize ${
                statusFilter === f ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div className="flex gap-1 flex-wrap">
          <span className="text-sm font-medium text-gray-500 self-center mr-1">Day:</span>
          {DAY_FILTERS.map(d => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className={`px-3 py-1.5 rounded text-sm border ${
                dayFilter === d ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          <span className="text-sm font-medium text-gray-500 self-center mr-1">Time:</span>
          {TIME_FILTERS.map(t => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-1.5 rounded text-sm border ${
                timeFilter === t ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading schedules...</p>
      ) : (
        <ScheduleList
          schedules={schedules}
          onCancel={schedule => setModal({ cancel: schedule })}
          onDeleteOld={handleDeleteOld}
        />
      )}

      {modal === 'add' && (
        <Modal title="Add Session" onClose={() => setModal(null)}>
          <ScheduleForm onSubmit={handleAdd} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.cancel && (
        <Modal title="Cancel Session" onClose={() => setModal(null)}>
          <CancelModal
            schedule={modal.cancel}
            onConfirm={handleCancel}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal === 'recurring' && (
        <Modal title="Create Recurring Series" onClose={() => setModal(null)}>
          <RecurringForm onSubmit={handleAddRecurring} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
