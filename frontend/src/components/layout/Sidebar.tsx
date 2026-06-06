import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDashboard } from "../../hooks/queries/useDashboard";
import "./Sidebar.css";

const orgHubLogo = new URL("../../assets/orghub-logo.png", import.meta.url).href;

interface NavItem {
  id: string;
  label: string;
  path: string;
  matchPrefix?: boolean;
  icon: React.ReactNode;
}

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'orghub_sidebar_collapsed';

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggleCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed: () => setCollapsed((c) => !c) }}>
      {children}
    </SidebarContext.Provider>
  );
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    id: "workspace",
    label: "Workspace",
    path: "/workspace",
    matchPrefix: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Tasks",
    path: "/tasks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 5h8" />
        <path d="M13 12h8" />
        <path d="M13 19h8" />
        <path d="m3 17 2 2 4-4" />
        <path d="m3 7 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "Calendar",
    path: "/calendar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
        <path d="M16 18h.01" />
      </svg>
    ),
  },
  {
    id: "files",
    label: "Files",
    path: "/files",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    ),
  },
  {
    id: "announcements",
    label: "Announcements",
    path: "/announcements",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
        <path d="M8 6v8" />
      </svg>
    ),
  },
];

const bottomItems: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.matchPrefix) {
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  }
  return pathname === item.path;
}

function SidebarInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutAction } = useAuth();
  const { currentOrganizationId } = useWorkspace();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { data: dashboard } = useDashboard();
  const pendingInvitationCount = dashboard?.pending_invitations.length ?? 0;

  const handleLogout = () => {
    logoutAction();
    navigate("/");
  };

  return (
    <aside
      className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}
      id="main-sidebar"
    >
      <Link
        to="/dashboard"
        className="sidebar__logo"
        aria-label="Go to dashboard"
        title={collapsed ? "Dashboard" : undefined}
      >
        <div className="sidebar__logo-icon">
          <img className="sidebar__logo-img" src={orgHubLogo} alt="" />
        </div>
        <span className="sidebar__logo-info">
          <span className="sidebar__logo-name">OrgHub</span>
          {/*<span className="sidebar__logo-sub">STUDENT PORTAL</span>*/}
        </span>
      </Link>

      <nav className="sidebar__nav">
        {navItems.map((item) => {
          const active = isActive(item, location.pathname);
          return (
            <button
              key={item.id}
              className={`sidebar__nav-item ${active ? "sidebar__nav-item--active" : ""}`}
              onClick={() =>
                navigate(
                  item.id === "workspace" && currentOrganizationId
                    ? `/workspace/orgs/${currentOrganizationId}`
                    : item.path,
                )
              }
              id={`nav-${item.id}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar__nav-icon">{item.icon}</span>
              <span className="sidebar__nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar__bottom">
        {bottomItems.map((item) => {
          const active = isActive(item, location.pathname);
          return (
            <button
              key={item.id}
              className={`sidebar__nav-item ${active ? "sidebar__nav-item--active" : ""}`}
              onClick={() => navigate(item.path)}
              id={`nav-${item.id}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar__nav-icon">{item.icon}</span>
              <span className="sidebar__nav-label">{item.label}</span>
              {item.id === "settings" && pendingInvitationCount > 0 && (
                <span
                  className="sidebar__pending-dot"
                  aria-label={`${pendingInvitationCount} pending invitation${pendingInvitationCount === 1 ? "" : "s"}`}
                />
              )}
            </button>
          );
        })}
        <button
          className="sidebar__nav-item sidebar__nav-item--logout"
          onClick={handleLogout}
          id="nav-logout"
          title={collapsed ? "Log Out" : undefined}
        >
          <span className="sidebar__nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
          </span>
          <span className="sidebar__nav-label">Log Out</span>
        </button>

        <button
          className="sidebar__toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`sidebar__toggle-icon${collapsed ? " sidebar__toggle-icon--flipped" : ""}`}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return <SidebarInner />;
}
