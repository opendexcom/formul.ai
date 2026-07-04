import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/shell/AppShell';
import ProjectShell from '../components/shell/ProjectShell';
import OverviewPage from '../pages/OverviewPage';
import IntegrationsPage from '../pages/IntegrationsPage';
import HelpSupportPage from '../pages/HelpSupportPage';
import UserPreferencesPage from '../pages/UserPreferencesPage';
import AdminSettings from '../pages/AdminSettings';
import ProjectOverviewTab from '../pages/ProjectOverviewTab';
import ProjectVariantsPage from '../pages/ProjectVariantsPage';
import ProjectFormRedirectPage from '../pages/ProjectFormRedirectPage';
import ProjectResponsesPage from '../pages/ProjectResponsesPage';
import ProjectAnalyticsPage from '../pages/ProjectAnalyticsPage';
import ProjectStudyAnalyticsPage from '../pages/ProjectStudyAnalyticsPage';
import ProjectComparePage from '../pages/ProjectComparePage';
import { useAuthenticatedPluginRoutes } from '../plugins/PluginRoutes';

const AuthenticatedApp: React.FC = () => {
  const pluginRoutes = useAuthenticatedPluginRoutes();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="studies" element={<Navigate to="/overview#studies" replace />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="help" element={<HelpSupportPage />} />
        <Route path="settings/preferences" element={<UserPreferencesPage />} />
        <Route path="admin/settings" element={<AdminSettings />} />
        {pluginRoutes}
        <Route path="projects/:projectId" element={<ProjectShell />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ProjectOverviewTab />} />
          <Route path="variants" element={<ProjectVariantsPage />} />
          <Route path="variants/:key/edit" element={<ProjectFormRedirectPage />} />
          <Route path="variants/:key/responses" element={<ProjectResponsesPage />} />
          <Route path="variants/:key/analytics" element={<ProjectAnalyticsPage />} />
          <Route path="analytics" element={<ProjectStudyAnalyticsPage />} />
          <Route path="compare" element={<ProjectComparePage />} />
        </Route>
        <Route path="dashboard" element={<Navigate to="/overview" replace />} />
        <Route path="projects" element={<Navigate to="/overview" replace />} />
        <Route path="projects/new" element={<Navigate to="/overview" replace />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
};

export default AuthenticatedApp;
