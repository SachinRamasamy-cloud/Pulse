import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Landing      from './pages/Landing';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import ServerDetail from './pages/ServerDetail';
import Pricing      from './pages/Pricing';
import Success      from './pages/Success';
import Navbar       from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner full />;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner full />;
  return !user ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login"    element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

        {/* Protected */}
        <Route path="/dashboard"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/servers/:id"     element={<PrivateRoute><ServerDetail /></PrivateRoute>} />
        <Route path="/success"         element={<PrivateRoute><Success /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
