import { useState } from 'react';
import { api } from '../../lib/api';

const STATUS_STYLES = {
  present: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', label: 'Present' },
  free:    { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', label: 'Free' },
  absent:  { bg: 'bg-white border-gray-200', badge: 'bg-gray-100 text-gray-600', label: 'Absent' },
};

function FreeReasonModal({ student, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onConfirm(reason); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold mb-3">Mark {student.name} as Free</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text" value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (e.g. sibling, sick, location)"
            className="w-full border rounded px-3 py-2 text-sm mb-4"
          />
          <div className="flex gap-2">
            <button
              type="submit" disabled={loading}
              className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Mark Free'}
            </button>
            <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CheckInView({ scheduleId, students: initialStudents }) {
  const [students, setStudents] = useState(initialStudents);
  const [freeModal, setFreeModal] = useState(null); // null | student object

  function updateStudentAttendance(studentId, attendance) {
    setStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, attendance } : s)
    );
  }

  async function handleCheckIn(student) {
    const data = await api.post('/attendance/check-in', {
      schedule_id: scheduleId,
      student_id: student.id,
    });
    updateStudentAttendance(student.id, data);
  }

  async function handleFree(student, reason) {
    const data = await api.post('/attendance/free', {
      schedule_id: scheduleId,
      student_id: student.id,
      free_reason: reason,
    });
    updateStudentAttendance(student.id, data);
    setFreeModal(null);
  }

  async function handleUndo(student) {
    const data = await api.patch(`/attendance/${student.attendance.id}/undo`);
    updateStudentAttendance(student.id, data);
  }

  const status = (student) => student.attendance?.status || 'absent';

  const presentCount = students.filter(s => status(s) === 'present').length;
  const freeCount = students.filter(s => status(s) === 'free').length;

  return (
    <div>
      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>Total: <strong>{students.length}</strong></span>
        <span className="text-green-700">Present: <strong>{presentCount}</strong></span>
        <span className="text-yellow-700">Free: <strong>{freeCount}</strong></span>
        <span className="text-gray-500">Absent: <strong>{students.length - presentCount - freeCount}</strong></span>
      </div>

      {students.length === 0 && (
        <p className="text-gray-500 text-center py-8">No students in this age category.</p>
      )}

      <div className="space-y-2">
        {students.map(student => {
          const st = status(student);
          const styles = STATUS_STYLES[st];
          return (
            <div
              key={student.id}
              className={`border rounded-lg p-3 flex items-center justify-between ${styles.bg}`}
            >
              <div>
                <div className="font-medium">{student.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}>
                    {styles.label}
                  </span>
                  {student.attendance?.free_reason && (
                    <span className="text-xs text-gray-500">({student.attendance.free_reason})</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {st !== 'present' && (
                  <button
                    onClick={() => handleCheckIn(student)}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
                  >
                    Check In
                  </button>
                )}
                {st !== 'free' && (
                  <button
                    onClick={() => setFreeModal(student)}
                    className="bg-yellow-500 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-600"
                  >
                    Free
                  </button>
                )}
                {st !== 'absent' && (
                  <button
                    onClick={() => handleUndo(student)}
                    className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {freeModal && (
        <FreeReasonModal
          student={freeModal}
          onConfirm={(reason) => handleFree(freeModal, reason)}
          onClose={() => setFreeModal(null)}
        />
      )}
    </div>
  );
}
