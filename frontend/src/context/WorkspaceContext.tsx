
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import type {
  DivisionRole,
  MembershipsBundle,
  OrgMembershipSummary,
  OrgRole,
  ProjectRole,
} from '../types/api';

interface WorkspaceContextValue {
  memberships: MembershipsBundle;
  currentOrganizationId: number | null;
  currentOrganization: OrgMembershipSummary | null;
  setCurrentOrganization: (organizationId: number) => void;
  isCoreBoard: (organizationId: number) => boolean;
  isOrgMember: (organizationId: number) => boolean;
  organizationRole: (organizationId: number) => OrgRole | null;
  isDivisionHead: (divisionId: number) => boolean;
  isDivisionMember: (divisionId: number) => boolean;
  divisionRole: (divisionId: number) => DivisionRole | null;
  isProjectLead: (projectId: number) => boolean;
  isProjectMember: (projectId: number) => boolean;
  projectRole: (projectId: number) => ProjectRole | null;
  /** Convenience: can this user manage the given division (Core Board OR Division Head)? */
  canManageDivision: (organizationId: number, divisionId: number) => boolean;
  /** Convenience: can this user manage the given project (Core Board / Division Head / Project Lead)? */
  canManageProject: (organizationId: number, divisionId: number, projectId: number) => boolean;
}

const empty: MembershipsBundle = { organizations: [], divisions: [], projects: [] };

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const memberships = user?.memberships ?? empty;
  const storageKey = user ? `orghub_current_organization_${user.id}` : null;
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(() => {
    if (!user) return null;
    const stored = localStorage.getItem(`orghub_current_organization_${user.id}`);
    return stored ? Number(stored) : memberships.organizations[0]?.id ?? null;
  });
  const currentOrganizationId = memberships.organizations.some(
    (organization) => organization.id === selectedOrganizationId,
  )
    ? selectedOrganizationId
    : memberships.organizations[0]?.id ?? null;

  useEffect(() => {
    if (!storageKey) return;
    if (currentOrganizationId === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, String(currentOrganizationId));
    }
  }, [currentOrganizationId, storageKey]);

  const value = useMemo<WorkspaceContextValue>(() => {
    const orgRole = (organizationId: number): OrgRole | null =>
      memberships.organizations.find((o) => o.id === organizationId)?.role ?? null;
    const divRole = (divisionId: number): DivisionRole | null =>
      memberships.divisions.find((d) => d.id === divisionId)?.role ?? null;
    const projRole = (projectId: number): ProjectRole | null =>
      memberships.projects.find((p) => p.id === projectId)?.role ?? null;

    return {
      memberships,
      currentOrganizationId,
      currentOrganization:
        memberships.organizations.find((organization) => organization.id === currentOrganizationId) ??
        null,
      setCurrentOrganization: setSelectedOrganizationId,
      organizationRole: orgRole,
      divisionRole: divRole,
      projectRole: projRole,
      isCoreBoard: (id: number) => orgRole(id) === 'CORE_BOARD',
      isOrgMember: (id: number) => orgRole(id) !== null,
      isDivisionHead: (id: number) => divRole(id) === 'DIVISION_HEAD',
      isDivisionMember: (id: number) => divRole(id) !== null,
      isProjectLead: (id: number) => projRole(id) === 'PROJECT_LEAD',
      isProjectMember: (id: number) => projRole(id) !== null,
      canManageDivision: (organizationId: number, divisionId: number) =>
        orgRole(organizationId) === 'CORE_BOARD' || divRole(divisionId) === 'DIVISION_HEAD',
      canManageProject: (organizationId: number, divisionId: number, projectId: number) =>
        orgRole(organizationId) === 'CORE_BOARD' ||
        divRole(divisionId) === 'DIVISION_HEAD' ||
        projRole(projectId) === 'PROJECT_LEAD',
    };
  }, [currentOrganizationId, memberships]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
