import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export default function DetailPanel({ studentId, period, onClose, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDetails() {
      try {
        const response = await api.get(
          `/reports/period-outstanding/${studentId}/details?start_date=${period.start_date}&end_date=${period.end_date}`
        );
        setData(response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [studentId, period]);

  // Mobile: Slide-up panel
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />

        {/* Slide-up panel */}
        <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="font-bold text-gray-900">Session & Payment Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : (
              <>
                {/* Sessions */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Sessions</h3>
                  {data.sessions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sessions in this period</p>
                  ) : (
                    <div className="space-y-2">
                      {data.sessions.map(session => (
                        <div key={session.id} className="bg-gray-50 rounded p-3 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{session.date}</p>
                              <p className="text-gray-600">{session.location}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              session.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                          {session.fee > 0 && (
                            <p className="mt-2 text-right font-semibold text-gray-900">${session.fee.toFixed(2)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Payments</h3>
                  {data.payments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No payments in this period</p>
                  ) : (
                    <div className="space-y-2">
                      {data.payments.map(payment => (
                        <div key={payment.id} className="bg-green-50 rounded p-3 text-sm border-l-2 border-green-500">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{payment.payment_date}</p>
                              {payment.notes && <p className="text-gray-600">{payment.notes}</p>}
                            </div>
                            <p className="font-semibold text-green-700">${payment.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop: Modal
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <h2 className="font-bold text-lg text-gray-900">Session & Payment Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Sessions */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Sessions</h3>
                  {data.sessions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sessions in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {data.sessions.map(session => (
                        <div key={session.id} className="bg-gray-50 rounded p-3 text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{session.date}</p>
                              <p className="text-gray-600 text-xs">{session.location}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                              session.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                          {session.fee > 0 && (
                            <p className="text-right font-semibold text-gray-900">${session.fee.toFixed(2)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Payments</h3>
                  {data.payments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No payments in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {data.payments.map(payment => (
                        <div key={payment.id} className="bg-green-50 rounded p-3 text-sm border-l-2 border-green-500">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{payment.payment_date}</p>
                              {payment.notes && <p className="text-gray-600 text-xs">{payment.notes}</p>}
                            </div>
                            <p className="font-semibold text-green-700 whitespace-nowrap ml-2">${payment.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
