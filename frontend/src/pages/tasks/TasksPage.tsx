import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import {
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Tabs,
  Select,
  Field,
} from '../../components/ui';
import KanbanBoard from '../../components/tasks/KanbanBoard';
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer';
import CreateTaskModal from '../../components/tasks/CreateTaskModal';
import { useTasks } from '../../hooks/queries/useTasks';
import { useDashboard } from '../../hooks/queries/useDashboard';
import { useAuth } from '../../context/AuthContext';
import type { Task } from '../../types/api';

type ViewKey = 'mine' | 'created' | 'managed' | 'all';

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { data: tasks, isLoading } = useTasks();
  const { data: dashboard } = useDashboard();
  const [view, setView] = useState<ViewKey>('mine');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (params.get('create') === '1') {
      setCreateOpen(true);
      params.delete('create');
      setParams(params, { replace: true });
    }
    const taskParam = params.get('task');
    if (taskParam && tasks) {
      const task = tasks.find((t) => t.id === Number(taskParam));
      if (task) setSelected(task);
    }
  }, [params, tasks]);

  const closeDrawer = () => {
    setSelected(null);
    if (params.has('task')) {
      params.delete('task');
      setParams(params, { replace: true });
    }
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let list: Task[] = tasks;
    if (view === 'mine') list = list.filter((t) => t.assigned_to === user?.id);
    else if (view === 'created') list = list.filter((t) => t.created_by === user?.id);
    else if (view === 'managed') {
      const managedIds = new Set((dashboard?.tasks?.managed ?? []).map((t) => t.id));
      list = list.filter((t) => managedIds.has(t.id));
    }
    if (scopeFilter === 'division') list = list.filter((t) => t.division !== null);
    else if (scopeFilter === 'project') list = list.filter((t) => t.project !== null);
    return list;
  }, [tasks, view, scopeFilter, user, dashboard]);

  const projectMemberships = user?.memberships?.projects ?? [];
  const divisionHeadMemberships = (user?.memberships?.divisions ?? []).filter(
    (d) => d.role === 'DIVISION_HEAD',
  );
  const defaultCreateScope =
    projectMemberships[0]
      ? { type: 'project' as const, id: projectMemberships[0].id }
      : divisionHeadMemberships[0]
      ? { type: 'division' as const, id: divisionHeadMemberships[0].id }
      : undefined;

  return (
    <AppShell>
      <PageHeader
        title="Tasks"
        subtitle="Drag tasks across columns to update their status."
        actions={
          defaultCreateScope ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              New task
            </Button>
          ) : undefined
        }
      />

      <Tabs
        active={view}
        onChange={(k) => setView(k as ViewKey)}
        tabs={[
          { key: 'mine', label: 'Assigned to me' },
          { key: 'created', label: 'Created by me' },
          { key: 'managed', label: 'Managing' },
          { key: 'all', label: 'All visible' },
        ]}
      />

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1.25rem 0' }}>
        <div style={{ minWidth: 200 }}>
          <Field label="Scope">
            <Select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
              <option value="all">All scopes</option>
              <option value="division">Division tasks</option>
              <option value="project">Project tasks</option>
            </Select>
          </Field>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
        </div>
      </div>

      {isLoading ? (
        <Spinner size="lg" />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks here"
          description={
            view === 'mine'
              ? 'No tasks are assigned to you in this filter.'
              : view === 'created'
              ? "You haven't created any tasks yet."
              : view === 'managed'
              ? 'You are not currently managing any open tasks.'
              : 'No tasks visible with the current filter.'
          }
        />
      ) : (
        <KanbanBoard
          tasks={filteredTasks}
          currentUserId={user?.id}
          onSelect={(t) => setSelected(t)}
        />
      )}

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultScope={defaultCreateScope}
      />
      <TaskDetailDrawer
        open={Boolean(selected)}
        task={selected}
        currentUserId={user?.id}
        onClose={closeDrawer}
      />
    </AppShell>
  );
}
