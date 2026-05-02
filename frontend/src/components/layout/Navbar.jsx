import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate('/login');
  }

  function handleNavClick() {
    setMenuOpen(false);
  }

  return (
    <nav className="bg-blue-700 text-white px-6 py-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-lg">DTMS Badminton</span>

        {/* Desktop Navigation - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/dashboard" className="text-sm hover:underline">Dashboard</Link>
          <Link to="/students" className="text-sm hover:underline">Students</Link>
          <Link to="/schedules" className="text-sm hover:underline">Schedules</Link>
          <Link to="/reports" className="text-sm hover:underline">Reports</Link>
          <Link to="/settings/backup-reminders" className="text-sm hover:underline">Backup Settings</Link>
          <button onClick={handleLogout} className="text-sm hover:underline">Logout</button>
        </div>

        {/* Mobile Hamburger Button - Visible only on mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-white text-2xl focus:outline-none"
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      {/* Mobile Menu Overlay and Slide-out */}
      {menuOpen && (
        <div className="fixed inset-0 md:hidden z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setMenuOpen(false)}
          />

          {/* Slide-out Menu */}
          <div className="absolute top-0 left-0 h-screen w-64 bg-blue-700 shadow-lg z-50 flex flex-col pt-4">
            <div className="flex-1 px-4 space-y-4">
              <Link
                to="/dashboard"
                className="block py-2 text-white hover:bg-blue-600 px-3 rounded"
                onClick={handleNavClick}
              >
                Dashboard
              </Link>
              <Link
                to="/students"
                className="block py-2 text-white hover:bg-blue-600 px-3 rounded"
                onClick={handleNavClick}
              >
                Students
              </Link>
              <Link
                to="/schedules"
                className="block py-2 text-white hover:bg-blue-600 px-3 rounded"
                onClick={handleNavClick}
              >
                Schedules
              </Link>
              <Link
                to="/reports"
                className="block py-2 text-white hover:bg-blue-600 px-3 rounded"
                onClick={handleNavClick}
              >
                Reports
              </Link>
              <Link
                to="/settings/backup-reminders"
                className="block py-2 text-white hover:bg-blue-600 px-3 rounded"
                onClick={handleNavClick}
              >
                Backup Settings
              </Link>
            </div>

            {/* Logout Button at Bottom */}
            <div className="border-t border-blue-600 px-4 py-4">
              <button
                onClick={handleLogout}
                className="w-full py-2 text-white hover:bg-blue-600 px-3 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
