import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const STATUS_BADGES = {
  present: 'bg-green-100 text-green-800',
  free:    'bg-yellow-100 text-yellow-800',
};

export default function ParentPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/parent/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Invalid or expired link');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <p className="text-gray-400 text-sm mt-2">Please ask your coach for a new link.</p>
      </div>
    </div>
  );

  const { student, sessions, payments, summary } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-blue-200 text-sm">DTMS Badminton Coaching</p>
          <h1 className="text-xl font-bold">{student.name}</h1>
          <p className="text-blue-200 text-sm">{student.age_category} · {student.skill_level}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">

        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-xl font-bold">${summary.total_owed.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Owed</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-green-700">${summary.total_paid.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Paid</div>
          </div>
          <div className={`rounded-lg p-3 text-center shadow-sm ${summary.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className={`text-xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
              ${summary.balance.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">{summary.balance > 0 ? 'Outstanding' : 'Balance'}</div>
          </div>
        </div>

        {/* Attendance history */}
        <h2 className="text-base font-semibold mb-2">
          Attendance History <span className="text-gray-400 font-normal text-sm">({sessions.length} sessions)</span>
        </h2>
        {sessions.length === 0 ? (
          <p className="text-gray-400 text-sm mb-6">No sessions recorded yet.</p>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b">
                  <th className="px-4 py-2 font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Location</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Fee</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="px-4 py-2">{s.schedule?.date}</td>
                    <td className="px-4 py-2 text-gray-600">{s.schedule?.location}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
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

        {/* Payments */}
        <h2 className="text-base font-semibold mb-2">
          Payments <span className="text-gray-400 font-normal text-sm">({payments.length})</span>
        </h2>
        {payments.length === 0 ? (
          <p className="text-gray-400 text-sm">No payments recorded yet.</p>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b">
                  <th className="px-4 py-2 font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Amount</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="px-4 py-2">{p.payment_date}</td>
                    <td className="px-4 py-2 text-right font-medium">${Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-2 text-gray-500">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
