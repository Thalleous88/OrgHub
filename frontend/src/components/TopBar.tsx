import { useAuth } from '../context/AuthContext';
import type { DashboardNotification } from '../services/api';
import './TopBar.css';

interface TopBarProps {
  notifications: DashboardNotification[];
}

export default function TopBar({ notifications }: TopBarProps) {
  const { user } = useAuth();
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const displayName = user?.profile?.full_name || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="topbar" id="main-topbar">
      {/* Search */}
      <div className="topbar__search">
        <svg className="topbar__search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.5"/>
          <path d="M13 13l3 3" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search tasks, docs, or members..."
          className="topbar__search-input"
          id="global-search"
        />
      </div>

      {/* Actions */}
      <div className="topbar__actions">
        {/* Notification Bell */}
        <button className="topbar__action-btn" id="notification-btn" aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a5 5 0 00-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 16a2 2 0 104 0" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {unreadCount > 0 && (
            <span className="topbar__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* Help */}
        <button className="topbar__action-btn" id="help-btn" aria-label="Help">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7.5 8a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="14.5" r="0.5" fill="currentColor"/>
          </svg>
        </button>

        {/* User Avatar */}
        <div className="topbar__user" id="user-menu">
          <div className="topbar__avatar">{initials}</div>
          <div className="topbar__user-info">
            <span className="topbar__user-name">{displayName}</span>
            <span className="topbar__user-role">Member</span>
          </div>
        </div>
      </div>
    </header>
  );
}
