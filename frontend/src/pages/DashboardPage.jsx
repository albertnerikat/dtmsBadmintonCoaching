import { useState, useEffect, useRef } from 'react';
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

// Balloon popup showing a student list. Stays open while mouse is over trigger OR balloon.
function StudentBalloon({ students, navigate, visible, onEnter, onLeave }) {
  if (!visible || students.length === 0) return null;
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="absolute left-0 top-full mt-1 z-50 w-full min-w-[260px] bg-white border border-gray-200 rounded-lg shadow-xl p-3"
    >
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Students</div>
      {students.map(s => (
        <div
          key={s.id}
          onClick={() => navigate(`/ledger/${s.id}`)}
          className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
            s.balance > 0 ? 'bg-red-50' : ''
          }`}
        >
          <span className="text-blue-600 text-sm font-medium">{s.name}</span>
          <span className={`text-sm font-semibold ml-6 ${s.balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {s.balance > 0 ? `$${s.balance.toFixed(2)}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// Hook: returns show/scheduleHide handlers and visible state.
// The balloon stays visible for 150ms after mouse leaves, allowing the cursor to travel to it.
function useBalloon() {
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);
  const show = () => { clearTimeout(timer.current); setVisible(true); };
  const scheduleHide = () => { timer.current = setTimeout(() => setVisible(false), 150); };
  return { visible, show, scheduleHide };
}

function PastSessionsHeading({ stats }) {
  const { visible, show, scheduleHide } = useBalloon();
  return (
    <div className="relative inline-block mb-3" onMouseEnter={show} onMouseLeave={scheduleHide}>
      <h2 className="text-lg font-semibold cursor-default">
        Past Sessions <span className="text-gray-400 font-normal text-sm">(last 2)</span>
      </h2>
      {visible && (
        <div
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 whitespace-nowrap"
        >
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All-Time</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-gray-600">Total sessions</span>
              <span className="font-semibold">{stats.total}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-600">Present</span>
              <span className="font-semibold text-green-700">{stats.present}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-600">Free</span>
              <span className="font-semibold text-yellow-600">{stats.free}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-600">Absent</span>
              <span className="font-semibold text-red-600">{stats.absent}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CurrentMonthHero({ month, navigate }) {
  const { visible, show, scheduleHide } = useBalloon();

  return (
    <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-xl p-4 text-white mb-4">
      <div className="text-xs font-semibold opacity-80 mb-3">{month.label} · Current Month</div>

      {/* Stats row — hover triggers the balloon */}
      <div
        className="relative"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <div className="grid grid-cols-3 gap-3 text-center cursor-default">
          <div>
            <div className="text-xl font-bold">${month.total_owed.toFixed(2)}</div>
            <div className="text-xs opacity-70 mt-0.5">Total Owed</div>
          </div>
          <div>
            <div className="text-xl font-bold">${month.total_paid.toFixed(2)}</div>
            <div className="text-xs opacity-70 mt-0.5">Total Paid</div>
          </div>
          <div className="bg-white/15 rounded-lg py-1">
            <div className="text-xl font-bold">${month.outstanding.toFixed(2)}</div>
            <div className="text-xs opacity-70 mt-0.5">Outstanding</div>
          </div>
        </div>
        {month.students.length > 0 && (
          <StudentBalloon
            students={month.students}
            navigate={navigate}
            visible={visible}
            onEnter={show}
            onLeave={scheduleHide}
          />
        )}
      </div>

      {month.students.length === 0 && (
        <p className="text-xs opacity-60 text-center mt-3">No activity this month.</p>
      )}
      {month.students.length > 0 && (
        <p className="text-xs opacity-40 text-center mt-3">Hover to see students</p>
      )}
    </div>
  );
}

function PastMonthsList({ months, navigate }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Previous 6 Months
      </div>
      <div className="grid grid-cols-4 gap-1 text-xs text-gray-400 uppercase tracking-wide px-2 pb-2">
        <span>Month</span>
        <span className="text-right">Owed</span>
        <span className="text-right">Paid</span>
        <span className="text-right">Outstanding</span>
      </div>
      {months.map(m => (
        <MonthRow key={`${m.year}-${m.month}`} m={m} navigate={navigate} />
      ))}
    </div>
  );
}

function MonthRow({ m, navigate }) {
  const { visible, show, scheduleHide } = useBalloon();
  const shortLabel = `${m.label.slice(0, 3)} ${String(m.year).slice(2)}`;

  return (
    <div
      className="relative rounded-lg mb-1"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <div className={`grid grid-cols-4 gap-1 text-sm px-2 py-2 rounded-lg transition-colors cursor-default ${
        visible ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}>
        <span className={`font-medium ${visible ? 'text-blue-700' : 'text-gray-700'}`}>
          {shortLabel}
        </span>
        <span className="text-right">${m.total_owed.toFixed(2)}</span>
        <span className="text-right text-green-700">${m.total_paid.toFixed(2)}</span>
        <span className={`text-right font-semibold ${
          m.outstanding > 0 ? 'text-red-600' : 'text-green-700'
        }`}>
          {m.outstanding > 0 ? `$${m.outstanding.toFixed(2)}` : '—'}
        </span>
      </div>
      {m.students.length > 0 && (
        <StudentBalloon
          students={m.students}
          navigate={navigate}
          visible={visible}
          onEnter={show}
          onLeave={scheduleHide}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (!data) return <p className="text-red-600">Failed to load dashboard.</p>;

  const { upcoming_sessions, recent_sessions, session_stats, financial_summary } = data;

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
            <PastSessionsHeading stats={session_stats} />
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

        {/* Financial Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Financial Summary</h2>
          <CurrentMonthHero month={financial_summary.current_month} navigate={navigate} />
          <PastMonthsList months={financial_summary.past_months} navigate={navigate} />
        </div>

      </div>
    </div>
  );
}
