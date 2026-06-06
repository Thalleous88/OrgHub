import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import WorkspaceLandingPage from './pages/workspace/WorkspaceLandingPage';
import OrganizationDetailPage from './pages/workspace/OrganizationDetailPage';
import DivisionDetailPage from './pages/workspace/DivisionDetailPage';
import ProjectDetailPage from './pages/workspace/ProjectDetailPage';
import TasksPage from './pages/tasks/TasksPage';
import CalendarPage from './pages/calendar/CalendarPage';
import FilesPage from './pages/files/FilesPage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import SettingsPage from './pages/settings/SettingsPage';

function FullScreenLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--navy-950)',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border-primary)',
            borderTopColor: 'var(--teal-500)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span>Loading...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/?next=${next}`} replace />;
  }

  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          <Route path="/invitations/accept" element={<InvitationAcceptPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <WorkspaceLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/orgs/:orgId"
            element={
              <ProtectedRoute>
                <OrganizationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/divisions/:divisionId"
            element={
              <ProtectedRoute>
                <DivisionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <TasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/files"
            element={
              <ProtectedRoute>
                <FilesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={<Navigate to="/announcements" replace />}
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute>
                <AnnouncementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
