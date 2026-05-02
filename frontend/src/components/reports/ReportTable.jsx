export default function ReportTable({
  students,
  viewMode,
  selectedStudentId,
  setSelectedStudentId,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-200">
              <th className="px-4 py-3 font-semibold text-gray-900">Student Name</th>
              <th className="px-4 py-3 font-semibold text-gray-900">Age Category</th>
              <th className="px-4 py-3 font-semibold text-gray-900 text-right">Previous Balance</th>
              <th className="px-4 py-3 font-semibold text-gray-900 text-right">Period Outstanding</th>
              <th className="px-4 py-3 font-semibold text-gray-900 text-right">Total Outstanding</th>
              <th className="px-4 py-3 font-semibold text-gray-900">Status</th>
              {viewMode === 'detailed' && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={viewMode === 'detailed' ? 7 : 6} className="px-4 py-4 text-center text-gray-500">
                  No students found
                </td>
              </tr>
            ) : (
              students.map(student => (
                <tr
                  key={student.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    student.total_outstanding > 0 ? 'bg-red-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-gray-900 font-medium">{student.name}</td>
                  <td className="px-4 py-3 text-gray-600">{student.age_category}</td>
                  <td className="px-4 py-3 text-right font-medium">${student.previous_balance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">${student.period_outstanding.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${
                    student.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ${student.total_outstanding.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {student.total_outstanding > 0 ? (
                      <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                        Outstanding
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        Paid
                      </span>
                    )}
                  </td>
                  {viewMode === 'detailed' && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedStudentId(student.id)}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
