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
} from '../../hooks/queries/useWorkspace';
import { useTasks } from '../../hooks/queries/useTasks';
import { useScopeCalendar } from '../../hooks/queries/useCalendar';
import { useScopeDocuments } from '../../hooks/queries/useDocuments';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import type { Task } from '../../types/api';
import '../../components/workspace/WorkspaceCards.css';

type TabKey = 'tasks' | 'calendar' | 'files';

export default function ProjectDetailPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = Number(projectIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManageProject, projectRole } = useWorkspace();

  const { data: projects, isLoading: projsLoading } = useProjects();
  const { data: divisions } = useDivisions();
  const { data: organizations } = useOrganizations();
  const { data: tasks } = useTasks();

  const project = useMemo(
    () => projects?.find((p) => p.id === projectId),
    [projects, projectId],
  );
  const division = useMemo(
    () => (project ? divisions?.find((d) => d.id === project.division) : undefined),
    [project, divisions],
  );
  const organization = useMemo(
    () => (division ? organizations?.find((o) => o.id === division.organization) : undefined),
    [division, organizations],
  );

  const [tab, setTab] = useState<TabKey>('tasks');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const projectTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.project === projectId),
    [tasks, projectId],
  );

  const role = projectRole(projectId);
  const canManage =
    organization && division ? canManageProject(organization.id, division.id, projectId) : false;

  const { data: calendarEvents = [] } = useScopeCalendar(
    'projects',
    tab === 'calendar' ? projectId : undefined,
  );
  const { data: documents = [] } = useScopeDocuments(
    'projects',
    tab === 'files' ? projectId : undefined,
  );

  if (projsLoading) {
    return (
      <AppShell>
        <Spinner size="lg" label="Loading project..." />
      </AppShell>
    );
  }

  if (!project || !division || !organization) {
    return (
      <AppShell>
        <Breadcrumbs items={[{ label: 'Workspace', to: '/workspace' }, { label: 'Project' }]} />
        <EmptyState
          title="Project not found"
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
          { label: division.name, to: `/workspace/divisions/${division.id}` },
          { label: project.name },
        ]}
      />
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {project.name}
            {role && <Badge variant="teal">{role.replace('_', ' ')}</Badge>}
          </span>
        }
        subtitle={project.description || 'No description provided.'}
        actions={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setInviteOpen(true)}>
                Invite member
              </Button>
            )}
            {canManage && (
              <Button variant="primary" onClick={() => setCreateTaskOpen(true)}>
                New task
              </Button>
            )}
          </>
        }
      />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: 'tasks', label: 'Tasks' },
          { key: 'calendar', label: 'Calendar' },
          { key: 'files', label: 'Resources' },
        ]}
      />

      <div style={{ marginTop: '1.5rem' }}>
        {tab === 'tasks' && (
          projectTasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description={canManage ? 'Create your first task to get the team moving.' : 'Tasks will appear here as they are created.'}
              action={canManage ? (
                <Button variant="primary" size="sm" onClick={() => setCreateTaskOpen(true)}>Create task</Button>
              ) : undefined}
            />
          ) : (
            <KanbanBoard
              tasks={projectTasks}
              currentUserId={user?.id}
              onSelect={(t) => setSelectedTask(t)}
            />
          )
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
              <EmptyState title="No resources yet" description="Project documents will appear here." />
            ) : (
              <FileList documents={documents} canDelete={() => canManage} />
            )}
          </div>
        )}
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        scope="projects"
        scopeId={projectId}
        scopeName={project.name}
      />
      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        defaultScope={{ type: 'project', id: projectId }}
      />
      <CreateEventModal
        open={createEventOpen}
        onClose={() => setCreateEventOpen(false)}
        scope="projects"
        scopeId={projectId}
        scopeName={project.name}
      />
      <FileUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        scope="projects"
        scopeId={projectId}
        scopeName={project.name}
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
