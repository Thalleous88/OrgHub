import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ProjectCard } from '../../components/workspace/WorkspaceCards';
import CreateProjectModal from '../../components/workspace/CreateProjectModal';
import InviteMemberModal from '../../components/workspace/InviteMemberModal';
import KanbanBoard from '../../components/tasks/KanbanBoard';
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer';
import CreateTaskModal from '../../components/tasks/CreateTaskModal';
import CalendarMini from '../../components/calendar/CalendarMini';
import CreateEventModal from '../../components/calendar/CreateEventModal';
import FileList from '../../components/files/FileList';
import FileUploadModal from '../../components/files/FileUploadModal';
import {
  useDivisions,
  useOrganizations,
  useProjects,
  useDivisionMembers,
} from '../../hooks/queries/useWorkspace';
import { useTasks } from '../../hooks/queries/useTasks';
import { useScopeCalendar } from '../../hooks/queries/useCalendar';
import { useScopeDocuments } from '../../hooks/queries/useDocuments';
import { useDashboard } from '../../hooks/queries/useDashboard';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import type { Task } from '../../types/api';
import '../../components/workspace/WorkspaceCards.css';

type TabKey = 'projects' | 'tasks' | 'calendar' | 'files' | 'members';

export default function DivisionDetailPage() {
  const { divisionId: divisionIdParam } = useParams<{ divisionId: string }>();
  const divisionId = Number(divisionIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManageDivision, isCoreBoard, isDivisionMember, divisionRole, memberships } = useWorkspace();

  const { data: divisions, isLoading: divsLoading } = useDivisions();
  const { data: organizations } = useOrganizations();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const { data: dashboard } = useDashboard();

  const division = useMemo(
    () => divisions?.find((d) => d.id === divisionId),
    [divisions, divisionId],
  );
  const organization = useMemo(
    () => (division ? organizations?.find((o) => o.id === division.organization) : undefined),
    [division, organizations],
  );

  const [tab, setTab] = useState<TabKey>('projects');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const divisionProjects = useMemo(
    () => (projects ?? []).filter((p) => p.division === divisionId),
    [projects, divisionId],
  );

  const projectSummaryById = new Map(
    (dashboard?.management_summary?.projects ?? []).map((p) => [p.id, p]),
  );
  const projectRoleById = new Map(memberships.projects.map((p) => [p.id, p.role]));

  const divisionTasks = useMemo(
    () =>
      (tasks ?? []).filter(
        (t) => t.division === divisionId || (t.project && divisionProjects.some((p) => p.id === t.project)),
      ),
    [tasks, divisionId, divisionProjects],
  );

  const orgIsCoreBoard = organization ? isCoreBoard(organization.id) : false;
  const canManage = organization ? canManageDivision(organization.id, divisionId) : false;
  const isMember = isDivisionMember(divisionId);
  const role = divisionRole(divisionId);

  const { data: calendarEvents = [] } = useScopeCalendar(
    'divisions',
    tab === 'calendar' ? divisionId : undefined,
  );
  const { data: documents = [] } = useScopeDocuments(
    'divisions',
    tab === 'files' ? divisionId : undefined,
  );
  const { data: divMembers, isLoading: membersLoading } = useDivisionMembers(
    tab === 'members' ? divisionId : undefined,
  );

  if (divsLoading) {
    return (
      <AppShell>
        <Spinner size="lg" label="Loading division..." />
      </AppShell>
    );
  }

  if (!division || !organization) {
    return (
      <AppShell>
        <Breadcrumbs items={[{ label: 'Workspace', to: '/workspace' }, { label: 'Division' }]} />
        <EmptyState
          title="Division not found"
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
          { label: organization.name, to: `/workspace/orgs/${organization.id}` },
          { label: division.name },
        ]}
      />
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {division.name}
            {role && <Badge variant="teal">{role.replace('_', ' ')}</Badge>}
          </span>
        }
        subtitle={division.description || 'No description provided.'}
        actions={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setInviteOpen(true)}>
                Invite member
              </Button>
            )}
            {canManage && (
              <Button variant="primary" onClick={() => setCreateProjectOpen(true)}>
                New project
              </Button>
            )}
          </>
        }
      />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: 'projects', label: 'Projects' },
          { key: 'tasks', label: 'Tasks' },
          { key: 'calendar', label: 'Calendar' },
          { key: 'files', label: 'Resources' },
          { key: 'members', label: 'Members' },
        ]}
      />

      <div style={{ marginTop: '1.5rem' }}>
        {tab === 'projects' && (
          divisionProjects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description={canManage ? 'Create a project to organize tasks and members.' : 'Projects will appear here once they are created.'}
              action={canManage ? (
                <Button variant="primary" size="sm" onClick={() => setCreateProjectOpen(true)}>Create project</Button>
              ) : undefined}
            />
          ) : (
            <div className="ws-grid">
              {divisionProjects.map((p) => {
                const summary = projectSummaryById.get(p.id);
                return (
                  <ProjectCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    description={p.description}
                    role={projectRoleById.get(p.id)}
                    membersCount={summary?.members_count}
                    openTasksCount={summary?.open_tasks_count}
                  />
                );
              })}
            </div>
          )
        )}

        {tab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {isMember && (
                <Button variant="primary" size="sm" onClick={() => setCreateTaskOpen(true)}>
                  New division task
                </Button>
              )}
            </div>
            {divisionTasks.length === 0 ? (
              <EmptyState
                title="No tasks yet"
                description="Division and project tasks for this division will appear here."
              />
            ) : (
              <KanbanBoard
                tasks={divisionTasks}
                currentUserId={user?.id}
                onSelect={(t) => setSelectedTask(t)}
              />
            )}
          </div>
        )}

        {tab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {canManage && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" size="sm" onClick={() => setCreateEventOpen(true)}>
                  New event
                </Button>
              </div>
            )}
            <CalendarMini events={calendarEvents} />
          </div>
        )}

        {tab === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {canManage && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
                  Upload file
                </Button>
              </div>
            )}
            {documents.length === 0 ? (
              <EmptyState
                title="No resources yet"
                description="Documents uploaded to this division will appear here."
              />
            ) : (
              <FileList
                documents={documents}
                canDelete={() => canManage}
              />
            )}
          </div>
        )}

        {tab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {canManage && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
                  Invite member
                </Button>
              </div>
            )}
            {membersLoading ? (
              <Spinner />
            ) : !divMembers || divMembers.length === 0 ? (
              <EmptyState
                title="No members yet"
                description="Division members will appear here once they join."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divMembers.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {m.full_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                          {m.email}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <Badge variant={m.role === 'DIVISION_HEAD' ? 'teal' : 'gray'}>
                            {m.role.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(m.joined_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        divisionId={divisionId}
        onCreated={(id) => navigate(`/workspace/projects/${id}`)}
      />
      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        scope="divisions"
        scopeId={divisionId}
        scopeName={division.name}
        parentScopeId={organization.id}
      />
      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        defaultScope={{ type: 'division', id: divisionId }}
      />
      <CreateEventModal
        open={createEventOpen}
        onClose={() => setCreateEventOpen(false)}
        scope="divisions"
        scopeId={divisionId}
        scopeName={division.name}
      />
      <FileUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        scope="divisions"
        scopeId={divisionId}
        scopeName={division.name}
      />
      <TaskDetailDrawer
        open={Boolean(selectedTask)}
        task={selectedTask}
        currentUserId={user?.id}
        onClose={() => setSelectedTask(null)}
      />
    </AppShell>
  );
}
