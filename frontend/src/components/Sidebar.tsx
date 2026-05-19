import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="2" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'workspace',
    label: 'Workspace',
    path: '/workspace',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14M3 10h14M3 15h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    path: '/calendar',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 2v4M14 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'files',
    label: 'Files',
    path: '/files',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4a2 2 0 012-2h4l2 2h4a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

const bottomItems = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 2v2M10 16v2M3.5 5l1.5 1.5M15 13.5l1.5 1.5M2 10h2M16 10h2M3.5 15l1.5-1.5M15 6.5l1.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'support',
    label: 'Support',
    path: '/support',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7.5 8a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="14" r="0.5" fill="currentColor"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutAction } = useAuth();

  const handleLogout = () => {
    logoutAction();
    navigate('/');
  };

  return (
    <aside className="sidebar animate-slide-in-left" id="main-sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="url(#sb-logo-grad)" />
            <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="sb-logo-grad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#14b8a6" />
                <stop offset="1" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="sidebar__logo-info">
          <span className="sidebar__logo-name">OrgHub</span>
          <span className="sidebar__logo-sub">STUDENT PORTAL</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__nav-item ${location.pathname === item.path ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
            id={`nav-${item.id}`}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span className="sidebar__nav-label">{item.label}</span>
            {location.pathname === item.path && <div className="sidebar__nav-indicator" />}
          </button>
        ))}
      </nav>

      {/* Bottom Nav */}
      <div className="sidebar__bottom">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__nav-item ${location.pathname === item.path ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
            id={`nav-${item.id}`}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span className="sidebar__nav-label">{item.label}</span>
          </button>
        ))}
        <button
          className="sidebar__nav-item sidebar__nav-item--logout"
          onClick={handleLogout}
          id="nav-logout"
        >
          <span className="sidebar__nav-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 17H4a2 2 0 01-2-2V5a2 2 0 012-2h3M13 14l4-4-4-4M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="sidebar__nav-label">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
