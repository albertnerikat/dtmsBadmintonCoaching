import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import CheckInView from '../components/attendance/CheckInView';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AttendancePage() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/schedules/${scheduleId}/attendance`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  const { schedule, students } = data;
  const dayName = DAYS[new Date(schedule.date + 'T00:00:00').getDay()];

  return (
    <div>
      <button onClick={() => navigate('/schedules')} className="text-blue-600 text-sm hover:underline mb-4 block">
        ← Back to Schedules
      </button>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h1 className="text-lg font-bold">{dayName}, {schedule.date}</h1>
        <div className="text-sm text-gray-600 mt-1">
          {schedule.time?.slice(0, 5)} · {schedule.duration_minutes} min · {schedule.location} · {schedule.age_category}
        </div>
        {schedule.status === 'cancelled' && (
          <div className="mt-2 text-red-600 text-sm font-medium">
            Cancelled: {schedule.cancellation_reason}
          </div>
        )}
      </div>

      {schedule.status === 'cancelled' ? (
        <p className="text-gray-500 text-center py-8">This session has been cancelled.</p>
      ) : (
        <CheckInView scheduleId={scheduleId} students={students} />
      )}
    </div>
  );
}
