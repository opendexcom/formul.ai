import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CapabilitiesProvider } from './context/CapabilitiesContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import FormEditor from './pages/FormEditor';
import FormAnalytics from './pages/FormAnalytics';
import PrintableAnalytics from './pages/PrintableAnalytics';
import PublicFormView from './pages/PublicFormView';
import EmailConfirmation from './pages/EmailConfirmation';
import ResetPassword from './pages/ResetPassword';
import AdminSettings from './pages/AdminSettings';
import { usePluginRoutes } from './plugins/PluginRoutes';
import './App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

// Public Route Component (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  const pluginRoutes = usePluginRoutes();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/new"
        element={
          <ProtectedRoute>
            <FormEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:id/edit"
        element={
          <ProtectedRoute>
            <FormEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:formId/analytics"
        element={
          <ProtectedRoute>
            <FormAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:formId/analytics/print"
        element={
          <ProtectedRoute>
            <PrintableAnalytics />
          </ProtectedRoute>
        }
      />
      {/* Public form route - accessible without authentication */}
      <Route
        path="/form/:formId"
        element={<PublicFormView />}
      />
      {pluginRoutes}
      <Route
        path="/confirm-email"
        element={<EmailConfirmation />}
      />
      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      {/* Redirect any unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <CapabilitiesProvider>
        <AuthProvider>
          <Router>
            <div className="App">
              <AppRoutes />
            </div>
          </Router>
        </AuthProvider>
      </CapabilitiesProvider>
    </ErrorBoundary>
  );
}

export default App;
