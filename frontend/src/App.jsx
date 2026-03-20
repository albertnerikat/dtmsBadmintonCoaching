import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import StudentsPage from './pages/StudentsPage';
import SchedulesPage from './pages/SchedulesPage';
import AttendancePage from './pages/AttendancePage';

function CoachLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </>
  );
}

function ProtectedCoachPage({ children }) {
  return (
    <ProtectedRoute>
      <CoachLayout>{children}</CoachLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/students" element={<ProtectedCoachPage><StudentsPage /></ProtectedCoachPage>} />
          <Route path="/schedules" element={<ProtectedCoachPage><SchedulesPage /></ProtectedCoachPage>} />
          <Route path="/attendance/:scheduleId" element={<ProtectedCoachPage><AttendancePage /></ProtectedCoachPage>} />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
