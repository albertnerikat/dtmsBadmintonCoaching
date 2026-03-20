import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">DTMS Badminton</span>
        <Link to="/students" className="text-sm hover:underline">Students</Link>
        <Link to="/schedules" className="text-sm hover:underline">Schedules</Link>
      </div>
      <button onClick={handleLogout} className="text-sm hover:underline">Logout</button>
    </nav>
  );
}
