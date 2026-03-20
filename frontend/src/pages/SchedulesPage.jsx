import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import ScheduleList from '../components/schedules/ScheduleList';
import ScheduleForm from '../components/schedules/ScheduleForm';

const STATUS_FILTERS = ['All', 'scheduled', 'cancelled'];

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
  const [modal, setModal] = useState(null); // null | 'add' | { cancel: schedule }
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSchedules(); }, [statusFilter]);

  async function loadSchedules() {
    setLoading(true);
    try {
      const query = statusFilter === 'All' ? '/schedules' : `/schedules?status=${statusFilter}`;
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
    await api.post(`/schedules/${id}/cancel`, { reason });
    await loadSchedules();
    setModal(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Schedules</h1>
        <button
          onClick={() => setModal('add')}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
        >
          + Add Session
        </button>
      </div>

      <div className="flex gap-1 mb-4">
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

      {loading ? (
        <p className="text-gray-500">Loading schedules...</p>
      ) : (
        <ScheduleList
          schedules={schedules}
          onCancel={schedule => setModal({ cancel: schedule })}
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
    </div>
  );
}
