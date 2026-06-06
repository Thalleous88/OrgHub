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
import { DivisionCard, DivisionIcon } from '../../components/workspace/WorkspaceCards';
import CreateDivisionModal from '../../components/workspace/CreateDivisionModal';
import { useDivisions, useOrganizations } from '../../hooks/queries/useWorkspace';
import { useDashboard } from '../../hooks/queries/useDashboard';
import { useAuth } from '../../context/AuthContext';
import '../../components/workspace/WorkspaceCards.css';

type TabKey = 'divisions' | 'members';

export default function WorkspaceLandingPage() {
  const { user } = useAuth();
  const { data: divisions, isLoading: divsLoading } = useDivisions();
  const { data: organizations } = useOrganizations();
  const { data: dashboard } = useDashboard();

  const [tab, setTab] = useState<TabKey>('divisions');
  const [createDivisionOpen, setCreateDivisionOpen] = useState(false);

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
    return null;
  })();

  const hasDivisions = memberships?.divisions && memberships.divisions.length > 0;
  const hasProjects = memberships?.projects && memberships.projects.length > 0;

  return (
    <AppShell>
      <PageHeader
        title="Workspace"
        subtitle="Browse the divisions and members you have access to."
        actions={headerActions}
      />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: 'divisions', label: 'Divisions' },
          { key: 'members', label: 'Members' },
        ]}
      />

      {adminOrgs.length > 1 && tab === 'divisions' && (
        <div style={{ marginTop: '1rem', maxWidth: 320 }}>
          <Field label="Create division in">
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
                <DivisionIcon size={32} />
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

        {tab === 'members' && (
          (memberships?.organizations.length === 0 && !hasDivisions && !hasProjects) ? (
            <EmptyState
              title="No memberships"
              description="You aren't part of any organizations, divisions, or projects yet."
            />
          ) : (
            <>
              {(memberships?.organizations ?? []).length > 0 && (
                <div className="ws-section" style={{ marginBottom: '1.5rem' }}>
                  <h3 className="ws-section__title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                    Organizations
                  </h3>
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
                  </div>
                </div>
              )}
              {(hasDivisions || hasProjects) && (
                <div className="ws-section">
                  <h3 className="ws-section__title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                    Divisions & Projects
                  </h3>
                  <div className="ws-grid">
                    {(memberships?.divisions ?? []).map((d) => (
                      <div key={`div-${d.id}`} className="ws-card" style={{ cursor: 'default' }}>
                        <div className="ws-card__head">
                          <div className="ws-card__icon ws-card__icon--div">
                            <DivisionIcon />
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
                </div>
              )}
            </>
          )
        )}
      </div>

      {adminOrgId !== undefined && (
        <CreateDivisionModal
          open={createDivisionOpen}
          onClose={() => setCreateDivisionOpen(false)}
          organizationId={adminOrgId}
        />
      )}
    </AppShell>
  );
}
