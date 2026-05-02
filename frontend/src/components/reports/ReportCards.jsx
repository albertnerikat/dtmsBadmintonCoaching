export default function ReportCards({
  students,
  viewMode,
  selectedStudentId,
  setSelectedStudentId,
}) {
  return (
    <div className="space-y-3">
      {students.length === 0 ? (
        <div className="bg-white rounded-lg p-4 text-center text-gray-500">
          No students found
        </div>
      ) : (
        students.map(student => (
          <div
            key={student.id}
            className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${
              student.total_outstanding > 0 ? 'border-red-500' : 'border-green-500'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{student.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{student.age_category}</p>
              </div>
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                student.total_outstanding > 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {student.total_outstanding > 0 ? 'Outstanding' : 'Paid'}
              </span>
            </div>

            {/* Balance Info */}
            <div className="grid grid-cols-3 gap-2 mb-3 py-3 border-t border-b border-gray-100 text-center">
              <div>
                <div className="text-xs text-gray-500">Previous</div>
                <div className="font-semibold text-sm">${student.previous_balance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Period</div>
                <div className="font-semibold text-sm">${student.period_outstanding.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className={`font-bold text-sm ${
                  student.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  ${student.total_outstanding.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Details Button */}
            {viewMode === 'detailed' && (
              <button
                onClick={() => setSelectedStudentId(student.id)}
                className="w-full mt-2 text-blue-600 hover:underline text-sm font-medium py-2 bg-blue-50 rounded"
              >
                View Details
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
