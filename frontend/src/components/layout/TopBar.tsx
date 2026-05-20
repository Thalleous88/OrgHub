import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './TopBar.css';

export default function TopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.profile?.full_name || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const role = (() => {
    const orgs = user?.memberships?.organizations ?? [];
    const divs = user?.memberships?.divisions ?? [];
    const projs = user?.memberships?.projects ?? [];
    if (orgs.some((o) => o.role === 'CORE_BOARD')) return 'Core Board';
    if (divs.some((d) => d.role === 'DIVISION_HEAD')) return 'Division Head';
    if (projs.some((p) => p.role === 'PROJECT_LEAD')) return 'Project Lead';
    if (orgs.length || divs.length || projs.length) return 'Member';
    return 'Guest';
  })();

  return (
    <header className="topbar" id="main-topbar">
      <div className="topbar__spacer" />
      <div className="topbar__actions">
        <button
          type="button"
          className="topbar__user"
          id="user-menu"
          onClick={() => navigate('/settings')}
        >
          <div className="topbar__avatar">{initials}</div>
          <div className="topbar__user-info">
            <span className="topbar__user-name">{displayName}</span>
            <span className="topbar__user-role">{role}</span>
          </div>
        </button>
      </div>
    </header>
  );
}
