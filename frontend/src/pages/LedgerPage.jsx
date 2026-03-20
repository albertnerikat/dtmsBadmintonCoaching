import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import PaymentForm from '../components/payments/PaymentForm';

const STATUS_BADGES = {
  present: 'bg-green-100 text-green-800',
  free:    'bg-yellow-100 text-yellow-800',
};

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

export default function LedgerPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => { loadLedger(); }, [studentId]);

  async function loadLedger() {
    setLoading(true);
    try {
      setData(await api.get(`/students/${studentId}/ledger`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(form) {
    await api.post('/payments', form);
    await loadLedger();
    setShowPaymentModal(false);
  }

  async function handleDeletePayment(id) {
    if (!confirm('Delete this payment?')) return;
    await api.delete(`/payments/${id}`);
    await loadLedger();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  const { student, sessions, payments, summary } = data;

  return (
    <div>
      <button onClick={() => navigate('/students')} className="text-blue-600 text-sm hover:underline mb-4 block">
        ← Back to Students
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{student.name}</h1>
          <p className="text-sm text-gray-500">{student.skill_level}</p>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
        >
          + Record Payment
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">${summary.total_owed.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Total Owed</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">${summary.total_paid.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Total Paid</div>
        </div>
        <div className={`rounded-lg p-4 text-center ${summary.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className={`text-2xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
            ${summary.balance.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">{summary.balance > 0 ? 'Outstanding' : 'Balance'}</div>
        </div>
      </div>

      {/* Sessions table */}
      <h2 className="text-lg font-semibold mb-2">Attended Sessions ({summary.total_sessions})</h2>
      {sessions.length === 0 ? (
        <p className="text-gray-400 text-sm mb-6">No sessions attended yet.</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2 border">Date</th>
                <th className="px-3 py-2 border">Location</th>
                <th className="px-3 py-2 border">Status</th>
                <th className="px-3 py-2 border text-right">Fee</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{s.schedule?.date}</td>
                  <td className="px-3 py-2 border">{s.schedule?.location}</td>
                  <td className="px-3 py-2 border">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[s.status]}`}>
                      {s.status}
                    </span>
                    {s.free_reason && (
                      <span className="text-xs text-gray-400 ml-1">({s.free_reason})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border text-right">
                    {s.status === 'free'
                      ? <span className="text-gray-400">Free</span>
                      : `$${Number(s.schedule?.fee || 0).toFixed(2)}`
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments table */}
      <h2 className="text-lg font-semibold mb-2">Payments ({payments.length})</h2>
      {payments.length === 0 ? (
        <p className="text-gray-400 text-sm">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2 border">Date</th>
                <th className="px-3 py-2 border text-right">Amount</th>
                <th className="px-3 py-2 border">Notes</th>
                <th className="px-3 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{p.payment_date}</td>
                  <td className="px-3 py-2 border text-right font-medium">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-3 py-2 border text-gray-500">{p.notes || '—'}</td>
                  <td className="px-3 py-2 border">
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPaymentModal && (
        <Modal title="Record Payment" onClose={() => setShowPaymentModal(false)}>
          <PaymentForm
            studentId={studentId}
            onSubmit={handleRecordPayment}
            onCancel={() => setShowPaymentModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}
