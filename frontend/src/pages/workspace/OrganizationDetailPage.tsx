import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import {
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Badge,
  Tabs,
} from '../../components/ui';
import Breadcrumbs from '../../components/workspace/Breadcrumbs';
import { DivisionCard } from '../../components/workspace/WorkspaceCards';
import CreateDivisionModal from '../../components/workspace/CreateDivisionModal';
import InviteMemberModal from '../../components/workspace/InviteMemberModal';
import AnnouncementsList from '../../components/announcements/AnnouncementsList';
import CreateAnnouncementModal from '../../components/announcements/CreateAnnouncementModal';
import { useOrganizations, useDivisions } from '../../hooks/queries/useWorkspace';
import { useDashboard } from '../../hooks/queries/useDashboard';
import {
  useOrganizationAnnouncements,
} from '../../hooks/queries/useAnnouncements';
import { useWorkspace } from '../../context/WorkspaceContext';
import '../../components/workspace/WorkspaceCards.css';

type TabKey = 'divisions' | 'announcements' | 'members';

export default function OrganizationDetailPage() {
  const { orgId: orgIdParam } = useParams<{ orgId: string }>();
  const orgId = Number(orgIdParam);
  const navigate = useNavigate();
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const { data: divisions, isLoading: divsLoading } = useDivisions();
  const { data: dashboard } = useDashboard();
  const { isCoreBoard, organizationRole, memberships } = useWorkspace();
  const [tab, setTab] = useState<TabKey>('divisions');
  const [createDivisionOpen, setCreateDivisionOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);

  const organization = useMemo(
    () => organizations?.find((o) => o.id === orgId),
    [organizations, orgId],
  );

  const orgDivisions = useMemo(
    () => (divisions ?? []).filter((d) => d.organization === orgId),
    [divisions, orgId],
  );

  const divisionSummaryById = new Map(
    (dashboard?.management_summary?.divisions ?? []).map((d) => [d.id, d]),
  );
  const divisionRoleById = new Map(memberships.divisions.map((d) => [d.id, d.role]));

  const orgRole = organizationRole(orgId);
  const isAdmin = isCoreBoard(orgId);

  const { data: announcements, isLoading: annLoading } = useOrganizationAnnouncements(
    tab === 'announcements' ? orgId : undefined,
  );

  if (orgsLoading) {
    return (
      <AppShell>
        <Spinner size="lg" label="Loading organization..." />
      </AppShell>
    );
  }

  if (!organization) {
    return (
      <AppShell>
        <Breadcrumbs items={[{ label: 'Workspace', to: '/workspace' }, { label: 'Organization' }]} />
        <EmptyState
          title="Organization not found"
          description="It may have been deleted or you no longer have access."
          action={<Button variant="primary" onClick={() => navigate('/workspace')}>Back to workspace</Button>}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/workspace' },
          { label: organization.name },
        ]}
      />
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {organization.name}
            {orgRole && <Badge variant="teal">{orgRole.replace('_', ' ')}</Badge>}
          </span>
        }
        subtitle={organization.description || 'No description provided.'}
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" onClick={() => setInviteOpen(true)}>
                Invite member
              </Button>
            )}
            {isAdmin && (
              <Button variant="primary" onClick={() => setCreateDivisionOpen(true)}>
                New division
              </Button>
            )}
          </>
        }
      />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: 'divisions', label: 'Divisions' },
          { key: 'announcements', label: 'Announcements' },
          { key: 'members', label: 'Members' },
        ]}
      />

      <div style={{ marginTop: '1.5rem' }}>
        {tab === 'divisions' && (
          divsLoading ? (
            <Spinner />
          ) : orgDivisions.length === 0 ? (
            <EmptyState
              title="No divisions yet"
              description={isAdmin ? 'Create a division to organize your teams.' : 'You do not yet have access to any divisions in this organization.'}
              action={isAdmin ? (
                <Button variant="primary" size="sm" onClick={() => setCreateDivisionOpen(true)}>Create division</Button>
              ) : undefined}
            />
          ) : (
            <div className="ws-grid">
              {orgDivisions.map((d) => {
                const summary = divisionSummaryById.get(d.id);
                return (
                  <DivisionCard
                    key={d.id}
                    id={d.id}
                    name={d.name}
                    description={d.description}
                    role={divisionRoleById.get(d.id)}
                    projectsCount={summary?.projects_count}
                    openTasksCount={summary?.open_tasks_count}
                  />
                );
              })}
            </div>
          )
        )}

        {tab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" size="sm" onClick={() => setCreateAnnouncementOpen(true)}>
                  Post announcement
                </Button>
              </div>
            )}
            {annLoading ? (
              <Spinner />
            ) : !announcements || announcements.length === 0 ? (
              <EmptyState
                title="No announcements yet"
                description={isAdmin ? 'Broadcast updates to all members of this organization.' : 'Check back later for organization-wide updates.'}
              />
            ) : (
              <AnnouncementsList announcements={announcements} canManage={isAdmin} />
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="ws-grid">
            {memberships.organizations
              .filter((o) => o.id === orgId)
              .map((o) => (
                <div key={o.id} className="ws-card" style={{ cursor: 'default' }}>
                  <div className="ws-card__head">
                    <div className="ws-card__icon ws-card__icon--org">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M3 17a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <Badge variant="teal">{o.role.replace('_', ' ')}</Badge>
                  </div>
                  <h3 className="ws-card__title">You</h3>
                  <p className="ws-card__desc">
                    Member-list endpoints are not exposed by the API yet. Use invitations to add members.
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>

      <CreateDivisionModal
        open={createDivisionOpen}
        onClose={() => setCreateDivisionOpen(false)}
        organizationId={orgId}
        onCreated={(id) => navigate(`/workspace/divisions/${id}`)}
      />
      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        scope="organizations"
        scopeId={orgId}
        scopeName={organization.name}
      />
      <CreateAnnouncementModal
        open={createAnnouncementOpen}
        onClose={() => setCreateAnnouncementOpen(false)}
        organizationId={orgId}
        organizationName={organization.name}
      />
    </AppShell>
  );
}
