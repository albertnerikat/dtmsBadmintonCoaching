import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  scheduled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-600',
};

const CATEGORY_COLORS = {
  U13: 'bg-green-100 text-green-800',
  U15: 'bg-blue-100 text-blue-800',
  U17: 'bg-purple-100 text-purple-800',
  Adults: 'bg-orange-100 text-orange-800',
  Mixed: 'bg-yellow-100 text-yellow-800',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleList({ schedules, onCancel }) {
  const navigate = useNavigate();

  if (schedules.length === 0) {
    return <p className="text-center text-gray-500 py-12">No sessions found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-3 py-2 border">Date</th>
            <th className="px-3 py-2 border">Time</th>
            <th className="px-3 py-2 border">Location</th>
            <th className="px-3 py-2 border">Category</th>
            <th className="px-3 py-2 border">Status</th>
            <th className="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map(s => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border font-medium">
                {s.date} <span className="text-gray-400 text-xs">({DAYS[new Date(s.date + 'T00:00:00').getDay()]})</span>
              </td>
              <td className="px-3 py-2 border">{s.time.slice(0, 5)}</td>
              <td className="px-3 py-2 border">{s.location}</td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[s.age_category]}`}>
                  {s.age_category}
                </span>
              </td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                  {s.status}
                </span>
                {s.cancellation_reason && (
                  <div className="text-gray-400 text-xs mt-0.5">{s.cancellation_reason}</div>
                )}
              </td>
              <td className="px-3 py-2 border">
                <div className="flex gap-3">
                  {s.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => navigate(`/attendance/${s.id}`)}
                        className="text-blue-600 hover:underline"
                      >
                        Check-in
                      </button>
                      <button
                        onClick={() => onCancel(s)}
                        className="text-red-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
