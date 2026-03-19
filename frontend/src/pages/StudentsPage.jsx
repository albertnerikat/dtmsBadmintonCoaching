import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import StudentList from '../components/students/StudentList';
import StudentForm from '../components/students/StudentForm';

const AGE_CATEGORIES = ['All', 'U13', 'U15', 'U17', 'Adults'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | { student }
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStudents(); }, []);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await api.get('/students');
      setStudents(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(form) {
    await api.post('/students', form);
    await loadStudents();
    setModal(null);
  }

  async function handleEdit(form) {
    await api.put(`/students/${modal.student.id}`, form);
    await loadStudents();
    setModal(null);
  }

  async function handleArchive(id) {
    if (!confirm('Archive this student? They will no longer appear in active lists.')) return;
    await api.patch(`/students/${id}/archive`);
    await loadStudents();
  }

  function handleCopyLink(student) {
    const link = `${window.location.origin}/parent/${student.parent_access_token}`;
    navigator.clipboard.writeText(link);
    alert('Parent link copied to clipboard!');
  }

  const filtered = students
    .filter(s => filter === 'All' || s.age_category === filter)
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Students</h1>
        <button
          onClick={() => setModal('add')}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
        >
          + Add Student
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-48"
        />
        <div className="flex gap-1">
          {AGE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded text-sm border ${
                filter === cat
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading students...</p>
      ) : (
        <StudentList
          students={filtered}
          onEdit={student => setModal({ student })}
          onArchive={handleArchive}
          onCopyLink={handleCopyLink}
        />
      )}

      {modal === 'add' && (
        <Modal title="Add Student" onClose={() => setModal(null)}>
          <StudentForm onSubmit={handleAdd} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.student && (
        <Modal title="Edit Student" onClose={() => setModal(null)}>
          <StudentForm
            initial={modal.student}
            onSubmit={handleEdit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
