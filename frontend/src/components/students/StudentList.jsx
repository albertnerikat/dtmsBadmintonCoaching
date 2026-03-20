import { useNavigate } from 'react-router-dom';

const CATEGORY_COLORS = {
  U13: 'bg-green-100 text-green-800',
  U15: 'bg-blue-100 text-blue-800',
  U17: 'bg-purple-100 text-purple-800',
  Adults: 'bg-orange-100 text-orange-800',
};

export default function StudentList({ students, onEdit, onArchive, onCopyLink }) {
  const navigate = useNavigate();

  if (students.length === 0) {
    return <p className="text-center text-gray-500 py-12">No students found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-3 py-2 border">Name</th>
            <th className="px-3 py-2 border">Age Category</th>
            <th className="px-3 py-2 border">Skill Level</th>
            <th className="px-3 py-2 border">Parent / Contact</th>
            <th className="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border font-medium">{student.name}</td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[student.age_category]}`}>
                  {student.age_category}
                </span>
              </td>
              <td className="px-3 py-2 border">{student.skill_level}</td>
              <td className="px-3 py-2 border">
                <div className="font-medium">{student.parent_name}</div>
                <div className="text-gray-500 text-xs">{student.parent_phone}</div>
              </td>
              <td className="px-3 py-2 border">
                <div className="flex gap-3">
                  <button onClick={() => onEdit(student)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => navigate(`/ledger/${student.id}`)} className="text-purple-600 hover:underline">Ledger</button>
                  <button onClick={() => onCopyLink(student)} className="text-green-600 hover:underline">Copy Link</button>
                  <button onClick={() => onArchive(student.id)} className="text-red-500 hover:underline">Archive</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
