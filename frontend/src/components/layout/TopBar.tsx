import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import "./TopBar.css";

export default function TopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useWorkspace();

  const displayName = user?.profile?.full_name || user?.email || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const role = (() => {
    if (currentOrganization) {
      return currentOrganization.role === "CORE_BOARD"
        ? "Core Board"
        : "Member";
    }
    const orgs = user?.memberships?.organizations ?? [];
    const divs = user?.memberships?.divisions ?? [];
    const projs = user?.memberships?.projects ?? [];
    if (orgs.some((o) => o.role === "CORE_BOARD")) return "Core Board";
    if (divs.some((d) => d.role === "DIVISION_HEAD")) return "Division Head";
    if (projs.some((p) => p.role === "PROJECT_LEAD")) return "Project Lead";
    if (orgs.length || divs.length || projs.length) return "Member";
    return "Guest";
  })();

  return (
    <header className="topbar" id="main-topbar">
      <div className="topbar__spacer" />
      <div className="topbar__actions">
        <button
          type="button"
          className="topbar__workspace"
          onClick={() => navigate("/settings?tab=organizations")}
          title="Open organization settings"
        >
          <span className="topbar__workspace-copy">
            <span className="topbar__workspace-label">Current workspace</span>
            <span className="topbar__workspace-name">
              {currentOrganization?.name ?? "No organization"}
            </span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 3.5L8.5 7 5 10.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="topbar__user"
          id="user-menu"
          onClick={() => navigate("/settings")}
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
