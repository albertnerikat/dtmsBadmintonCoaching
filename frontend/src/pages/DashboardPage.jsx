import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS = {
  U9:     'bg-pink-100 text-pink-800',
  U11:    'bg-cyan-100 text-cyan-800',
  U13:    'bg-green-100 text-green-800',
  U15:    'bg-blue-100 text-blue-800',
  U17:    'bg-purple-100 text-purple-800',
  U19:    'bg-indigo-100 text-indigo-800',
  Adults: 'bg-orange-100 text-orange-800',
  Mixed:  'bg-yellow-100 text-yellow-800',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (!data) return <p className="text-red-600">Failed to load dashboard.</p>;

  const { upcoming_sessions, recent_sessions, student_balances } = data;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todaySessions = upcoming_sessions.filter(s => s.date === todayStr);
  const futureSessions = upcoming_sessions.filter(s => s.date > todayStr);

  function SessionCard({ s }) {
    return (
      <div
        onClick={() => navigate(`/attendance/${s.id}`)}
        className="border rounded-lg p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="font-medium">
            {DAYS[new Date(s.date + 'T00:00:00').getDay()]}, {s.date}
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[s.age_category]}`}>
            {s.age_category}
          </span>
        </div>
        <div className="text-sm text-gray-500 mt-0.5">
          {s.time.slice(0, 5)} · {s.duration_minutes} min · {s.location}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-6">
          {/* Past Sessions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Past Sessions <span className="text-gray-400 font-normal text-sm">(last 2)</span>
            </h2>
            {recent_sessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No past sessions.</p>
            ) : (
              <div className="space-y-2">
                {recent_sessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {/* Today's Sessions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Today's Sessions</h2>
            {todaySessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No sessions scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {todaySessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {/* Upcoming Sessions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Upcoming Sessions <span className="text-gray-400 font-normal text-sm">(next 14 days)</span>
            </h2>
            {futureSessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No sessions scheduled in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {futureSessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>
        </div>

        {/* Outstanding Balances */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Outstanding Balances</h2>
          {student_balances.length === 0 ? (
            <p className="text-gray-400 text-sm">All students are up to date.</p>
          ) : (
            <div className="space-y-2">
              {student_balances.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/ledger/${s.id}`)}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className={`font-bold text-sm ${s.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {s.balance > 0
                      ? `Owes $${s.balance.toFixed(2)}`
                      : `Credit $${Math.abs(s.balance).toFixed(2)}`
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
