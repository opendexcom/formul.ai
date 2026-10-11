import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CapabilitiesProvider } from './context/CapabilitiesContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import FormEditor from './pages/FormEditor';
import FormAnalytics from './pages/FormAnalytics';
import PrintableAnalytics from './pages/PrintableAnalytics';
import PublicFormView from './pages/PublicFormView';
import EmailConfirmation from './pages/EmailConfirmation';
import ResetPassword from './pages/ResetPassword';
import AuthenticatedApp from './routes/AuthenticatedApp';
import { usePublicPluginRoutes } from './plugins/PluginRoutes';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/overview" replace />;
};

function AppRoutes() {
  const publicPluginRoutes = usePublicPluginRoutes();

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
      {publicPluginRoutes}
      <Route path="/form/:formId" element={<PublicFormView />} />
      <Route path="/confirm-email" element={<EmailConfirmation />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AuthenticatedApp />
          </ProtectedRoute>
        }
      />
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
