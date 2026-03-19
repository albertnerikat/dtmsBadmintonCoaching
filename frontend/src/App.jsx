import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import StudentsPage from './pages/StudentsPage';

function CoachLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <CoachLayout><StudentsPage /></CoachLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
