import { Link } from 'react-router-dom';
import { Badge } from '../ui';
import './WorkspaceCards.css';

interface OrgCardProps {
  id: number;
  name: string;
  role?: string;
  description?: string;
  divisionsCount?: number;
  projectsCount?: number;
  openTasksCount?: number;
}

export function OrgCard({ id, name, role, description, divisionsCount, projectsCount, openTasksCount }: OrgCardProps) {
  return (
    <Link to={`/workspace/orgs/${id}`} className="ws-card">
      <div className="ws-card__head">
        <div className="ws-card__icon ws-card__icon--org">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 17V7l4-4 4 4v10M11 17V11l3-3 3 3v6M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {role && <Badge variant="teal">{role.replace('_', ' ')}</Badge>}
      </div>
      <h3 className="ws-card__title">{name}</h3>
      {description && <p className="ws-card__desc">{description}</p>}
      <div className="ws-card__stats">
        {divisionsCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{divisionsCount}</span>
            <span className="ws-card__stat-lbl">Divisions</span>
          </div>
        )}
        {projectsCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{projectsCount}</span>
            <span className="ws-card__stat-lbl">Projects</span>
          </div>
        )}
        {openTasksCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{openTasksCount}</span>
            <span className="ws-card__stat-lbl">Open tasks</span>
          </div>
        )}
      </div>
    </Link>
  );
}

interface DivisionCardProps {
  id: number;
  name: string;
  role?: string;
  description?: string;
  projectsCount?: number;
  openTasksCount?: number;
}

export function DivisionIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 12h4" />
      <path d="M10 8h4" />
      <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
      <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    </svg>
  );
}

export function DivisionCard({ id, name, role, description, projectsCount, openTasksCount }: DivisionCardProps) {
  return (
    <Link to={`/workspace/divisions/${id}`} className="ws-card">
      <div className="ws-card__head">
        <div className="ws-card__icon ws-card__icon--div">
          <DivisionIcon />
        </div>
        {role && <Badge variant="teal">{role.replace('_', ' ')}</Badge>}
      </div>
      <h3 className="ws-card__title">{name}</h3>
      {description && <p className="ws-card__desc">{description}</p>}
      <div className="ws-card__stats">
        {projectsCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{projectsCount}</span>
            <span className="ws-card__stat-lbl">Projects</span>
          </div>
        )}
        {openTasksCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{openTasksCount}</span>
            <span className="ws-card__stat-lbl">Open tasks</span>
          </div>
        )}
      </div>
    </Link>
  );
}

interface ProjectCardProps {
  id: number;
  name: string;
  role?: string;
  description?: string;
  membersCount?: number;
  openTasksCount?: number;
}

export function ProjectCard({ id, name, role, description, membersCount, openTasksCount }: ProjectCardProps) {
  return (
    <Link to={`/workspace/projects/${id}`} className="ws-card">
      <div className="ws-card__head">
        <div className="ws-card__icon ws-card__icon--proj">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 7h14M7 3v4" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        {role && <Badge variant="teal">{role.replace('_', ' ')}</Badge>}
      </div>
      <h3 className="ws-card__title">{name}</h3>
      {description && <p className="ws-card__desc">{description}</p>}
      <div className="ws-card__stats">
        {membersCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{membersCount}</span>
            <span className="ws-card__stat-lbl">Members</span>
          </div>
        )}
        {openTasksCount !== undefined && (
          <div className="ws-card__stat">
            <span className="ws-card__stat-num">{openTasksCount}</span>
            <span className="ws-card__stat-lbl">Open tasks</span>
          </div>
        )}
      </div>
    </Link>
  );
}
