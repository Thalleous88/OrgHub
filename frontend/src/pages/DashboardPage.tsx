import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/queries/useDashboard';
import { AppShell } from '../components/layout/AppShell';
import DeadlineCard from '../components/DeadlineCard';
import MeetingCard from '../components/MeetingCard';
import GeneralFeed from '../components/GeneralFeed';
import { getApiErrorMessage } from '../lib/apiError';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: dashboard, isLoading, isError, error, refetch } = useDashboard();

  const displayName = dashboard?.profile?.full_name || user?.profile?.full_name || 'there';
  const firstName = displayName.split(' ')[0];

  const now = Date.now();

  const urgentCount = dashboard?.tasks?.assigned_to_me?.filter((t) => {
    if (t.status === 'Done' || !t.due_at) return false;
    const hours = (new Date(t.due_at).getTime() - now) / (1000 * 60 * 60);
    return hours < 72 && hours > 0;
  }).length || 0;

  const todayMeetings = dashboard?.calendar_events?.filter((e) => {
    const d = new Date(e.starts_at);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
  }).length || 0;

  return (
    <AppShell>
      {isLoading ? (
        <div className="dashboard-loading">
          <div className="dashboard-loading__spinner" />
          <p>Loading your workspace...</p>
        </div>
      ) : isError ? (
        <div className="dashboard-error animate-fade-in">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="var(--red-400)" strokeWidth="2"/>
            <path d="M20 12v10M20 26v1" stroke="var(--red-400)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h3>Connection Error</h3>
          <p>{getApiErrorMessage(error, 'Unable to load your dashboard.')}</p>
          <button onClick={() => refetch()} className="dashboard-error__retry">
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="dashboard-greeting animate-fade-in-up delay-1">
            <div className="dashboard-greeting__left">
              <h1>Hello, {firstName}!</h1>
              <p className="dashboard-greeting__summary">
                {urgentCount > 0 && (
                  <>You have <strong className="gradient-text">{urgentCount} urgent deadline{urgentCount > 1 ? 's' : ''}</strong></>
                )}
                {urgentCount > 0 && todayMeetings > 0 && ' and '}
                {todayMeetings > 0 && (
                  <>{urgentCount === 0 ? 'You have ' : ''}<strong className="gradient-text">{todayMeetings} meeting{todayMeetings > 1 ? 's' : ''}</strong> today</>
                )}
                {urgentCount === 0 && todayMeetings === 0 && (
                  <>You're all caught up — no urgent deadlines or meetings today.</>
                )}
                {urgentCount > 0 && todayMeetings === 0 && ' coming up soon'}
                .
              </p>
            </div>
            <button
              className="dashboard-greeting__create-btn"
              id="create-update-btn"
              onClick={() => navigate('/tasks?create=1')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Create Task
            </button>
          </div>

          {/* Top Widgets Row */}
          <div className="dashboard-widgets-row">
            <DeadlineCard tasks={dashboard?.tasks?.assigned_to_me || []} />
            <MeetingCard events={dashboard?.calendar_events || []} />
          </div>

          {/* Bottom Content Row */}
          <div className="dashboard-bottom-row">
            <GeneralFeed announcements={dashboard?.announcements || []} />
          </div>
        </>
      )}
    </AppShell>
  );
}
