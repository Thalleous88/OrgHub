import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import {
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Badge,
  Tabs,
  Field,
  Select,
} from '../../components/ui';
import { DivisionCard } from '../../components/workspace/WorkspaceCards';
import CreateDivisionModal from '../../components/workspace/CreateDivisionModal';
import AnnouncementsList from '../../components/announcements/AnnouncementsList';
import CreateAnnouncementModal from '../../components/announcements/CreateAnnouncementModal';
import { useDivisions, useOrganizations } from '../../hooks/queries/useWorkspace';
import { useAnnouncementFeed } from '../../hooks/queries/useAnnouncements';
import { useDashboard } from '../../hooks/queries/useDashboard';
import { useAuth } from '../../context/AuthContext';
import { useAcceptInvitation } from '../../hooks/queries/useInvitations';
import { useToast } from '../../components/ui';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getApiErrorMessage } from '../../lib/apiError';
import '../../components/workspace/WorkspaceCards.css';

type TabKey = 'divisions' | 'announcements' | 'members';

export default function WorkspaceLandingPage() {
  const { user } = useAuth();
  const { isCoreBoard } = useWorkspace();
  const { data: divisions, isLoading: divsLoading } = useDivisions();
  const { data: organizations } = useOrganizations();
  const { data: announcements, isLoading: annLoading } = useAnnouncementFeed();
  const { data: dashboard } = useDashboard();
  const acceptMut = useAcceptInvitation();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>('divisions');
  const [createDivisionOpen, setCreateDivisionOpen] = useState(false);
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);

  const memberships = user?.memberships;
  const divisionRoleById = new Map((memberships?.divisions ?? []).map((d) => [d.id, d.role]));
  const orgNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));
  const divisionSummaryById = new Map(
    (dashboard?.management_summary?.divisions ?? []).map((d) => [d.id, d]),
  );

  const adminOrgs = useMemo(
    () => (memberships?.organizations ?? []).filter((o) => o.role === 'CORE_BOARD'),
    [memberships],
  );

  const [adminOrgId, setAdminOrgId] = useState<number | undefined>(adminOrgs[0]?.id);

  useEffect(() => {
    if (adminOrgId === undefined && adminOrgs[0]) {
      setAdminOrgId(adminOrgs[0].id);
    }
  }, [adminOrgs, adminOrgId]);

  const pending = dashboard?.pending_invitations ?? [];

  const handleAccept = async (token: string) => {
    try {
      await acceptMut.mutateAsync(token);
      toast.success('Invitation accepted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not accept the invitation.'));
    }
  };

  const headerActions = (() => {
    if (tab === 'divisions' && adminOrgs.length > 0 && adminOrgId !== undefined) {
      return (
        <Button
          variant="primary"
          onClick={() => setCreateDivisionOpen(true)}
          leftIcon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        >
          New division
        </Button>
      );
    }
    if (tab === 'announcements' && adminOrgs.length > 0 && adminOrgId !== undefined) {
      return (
        <Button variant="primary" onClick={() => setCreateAnnouncementOpen(true)}>
          Post announcement
        </Button>
      );
    }
    return null;
  })();

  return (
    <AppShell>
      <PageHeader
        title="Workspace"
        subtitle="Browse the divisions, announcements, and members you have access to."
        actions={headerActions}
      />

      {pending.length > 0 && (
        <div className="ws-section animate-fade-in-up delay-1">
          <div className="ws-section__head">
            <h2 className="ws-section__title">
              <Badge variant="amber">{pending.length}</Badge>
              Pending invitations
            </h2>
          </div>
          <div className="ws-grid">
            {pending.map((inv) => (
              <div key={inv.id} className="ws-card" style={{ cursor: 'default' }}>
                <div className="ws-card__head">
                  <div className="ws-card__icon ws-card__icon--proj">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 6l7 5 7-5M3 6v8a2 2 0 002 2h10a2 2 0 002-2V6M3 6a2 2 0 012-2h10a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <Badge variant="amber">{inv.role.replace('_', ' ')}</Badge>
                </div>
                <h3 className="ws-card__title">
                  {inv.organization
                    ? 'Organization invitation'
                    : inv.division
                    ? 'Division invitation'
                    : 'Project invitation'}
                </h3>
                <p className="ws-card__desc">
                  Sent to <strong>{inv.email}</strong>
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  loading={acceptMut.isPending}
                  onClick={() => handleAccept(inv.token)}
                >
                  Accept invitation
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: 'divisions', label: 'Divisions' },
          { key: 'announcements', label: 'Announcements' },
          { key: 'members', label: 'Members' },
        ]}
      />

      {adminOrgs.length > 1 && (tab === 'divisions' || tab === 'announcements') && (
        <div style={{ marginTop: '1rem', maxWidth: 320 }}>
          <Field label={tab === 'divisions' ? 'Create division in' : 'Post announcement to'}>
            <Select
              value={adminOrgId ?? ''}
              onChange={(e) => setAdminOrgId(Number(e.target.value))}
            >
              {adminOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        {tab === 'divisions' && (
          divsLoading ? (
            <Spinner />
          ) : !divisions || divisions.length === 0 ? (
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M6 6h8v8H6zM18 6h8v8h-8zM6 18h8v8H6z" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M18 23h8M22 19v8" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
              title="No divisions yet"
              description={adminOrgs.length > 0 ? 'Create a division to organize your teams.' : 'Once you are added to a division it will appear here.'}
              action={adminOrgs.length > 0 && adminOrgId !== undefined ? (
                <Button variant="primary" size="sm" onClick={() => setCreateDivisionOpen(true)}>Create division</Button>
              ) : undefined}
            />
          ) : (
            <div className="ws-grid">
              {divisions.map((d) => {
                const summary = divisionSummaryById.get(d.id);
                const orgName = orgNameById.get(d.organization);
                return (
                  <DivisionCard
                    key={d.id}
                    id={d.id}
                    name={d.name}
                    description={orgName ? `${orgName} · ${d.description || 'No description'}` : d.description}
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
          annLoading ? (
            <Spinner />
          ) : !announcements || announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description={adminOrgs.length > 0 ? 'Post one to keep your organization informed.' : 'Broadcasts from your organizations will appear here.'}
              action={adminOrgs.length > 0 && adminOrgId !== undefined ? (
                <Button variant="primary" size="sm" onClick={() => setCreateAnnouncementOpen(true)}>Post announcement</Button>
              ) : undefined}
            />
          ) : (
            <AnnouncementsList
              announcements={announcements}
              canManage={(a) => isCoreBoard(a.organization)}
            />
          )
        )}

        {tab === 'members' && (
          (memberships?.organizations.length === 0 &&
            memberships?.divisions.length === 0 &&
            memberships?.projects.length === 0) ? (
            <EmptyState
              title="No memberships"
              description="You aren't part of any organizations, divisions, or projects yet."
            />
          ) : (
            <div className="ws-grid">
              {(memberships?.organizations ?? []).map((o) => (
                <div key={`org-${o.id}`} className="ws-card" style={{ cursor: 'default' }}>
                  <div className="ws-card__head">
                    <div className="ws-card__icon ws-card__icon--org">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M3 17a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <Badge variant="teal">{o.role.replace('_', ' ')}</Badge>
                  </div>
                  <h3 className="ws-card__title">{o.name}</h3>
                  <p className="ws-card__desc">Organization membership</p>
                </div>
              ))}
              {(memberships?.divisions ?? []).map((d) => (
                <div key={`div-${d.id}`} className="ws-card" style={{ cursor: 'default' }}>
                  <div className="ws-card__head">
                    <div className="ws-card__icon ws-card__icon--div">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <Badge variant="teal">{d.role.replace('_', ' ')}</Badge>
                  </div>
                  <h3 className="ws-card__title">{d.name}</h3>
                  <p className="ws-card__desc">Division membership</p>
                </div>
              ))}
              {(memberships?.projects ?? []).map((p) => (
                <div key={`proj-${p.id}`} className="ws-card" style={{ cursor: 'default' }}>
                  <div className="ws-card__head">
                    <div className="ws-card__icon ws-card__icon--proj">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M3 7h14M7 3v4" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <Badge variant="teal">{p.role.replace('_', ' ')}</Badge>
                  </div>
                  <h3 className="ws-card__title">{p.name}</h3>
                  <p className="ws-card__desc">Project membership</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {adminOrgId !== undefined && (
        <>
          <CreateDivisionModal
            open={createDivisionOpen}
            onClose={() => setCreateDivisionOpen(false)}
            organizationId={adminOrgId}
          />
          <CreateAnnouncementModal
            open={createAnnouncementOpen}
            onClose={() => setCreateAnnouncementOpen(false)}
            organizationId={adminOrgId}
            organizationName={adminOrgs.find((o) => o.id === adminOrgId)?.name}
          />
        </>
      )}
    </AppShell>
  );
}
