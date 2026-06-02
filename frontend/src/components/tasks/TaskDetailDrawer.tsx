import { useEffect, useState, type FormEvent } from 'react';
import { Drawer, Button, Field, Input, Textarea, Select, Badge, useToast } from '../ui';
import type { Task, TaskStatus } from '../../types/api';
import { useUpdateTask, useDeleteTask } from '../../hooks/queries/useTasks';
import { getApiErrorMessage } from '../../lib/apiError';
import './TaskDetailDrawer.css';

interface Props {
  open: boolean;
  task: Task | null;
  currentUserId?: number;
  onClose: () => void;
}

function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskDetailDrawer({ open, task, currentUserId, onClose }: Props) {
  const toast = useToast();
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();

  const isCreator = task ? task.created_by === currentUserId : false;
  const isAssignee = task ? (task.assigned_to ?? []).includes(currentUserId ?? -1) : false;
  const canEdit = isCreator;
  const canChangeStatus = isCreator || isAssignee;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'ToDo');
  const [dueAt, setDueAt] = useState(task ? toLocalInput(task.due_at) : '');
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setStatus(task?.status ?? 'ToDo');
    setDueAt(task ? toLocalInput(task.due_at) : '');
    setError('');
  }, [task?.id]);

  if (!task) {
    return <Drawer open={open} onClose={onClose}><div /></Drawer>;
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (canEdit) {
        await updateMut.mutateAsync({
          id: task.id,
          input: {
            title,
            description,
            status,
            due_at: dueAt ? new Date(dueAt).toISOString() : null,
          },
        });
        toast.success('Task updated.');
      } else if (canChangeStatus && status !== task.status) {
        await updateMut.mutateAsync({ id: task.id, input: { status } });
        toast.success('Status updated.');
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save task.'));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteMut.mutateAsync(task.id);
      toast.success('Task deleted.');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete task.'));
    }
  };

  const assigneeNames = (task.assigned_to_emails ?? [])
    .map((e) => e.split('@')[0])
    .join(', ') || 'Unassigned';

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="task-drawer">
        <header className="task-drawer__head">
          <div>
            <span className="task-drawer__eyebrow">
              {task.project ? 'Project task' : 'Division task'}
            </span>
            <h2 className="task-drawer__title">{task.title}</h2>
            <div className="task-drawer__chips">
              <Badge variant={status === 'Done' ? 'teal' : status === 'InProgress' ? 'amber' : 'neutral'}>
                {status === 'Done' ? 'Done' : status === 'InProgress' ? 'In Progress' : 'To Do'}
              </Badge>
              <Badge variant="neutral">Created by {task.created_by_email.split('@')[0]}</Badge>
              {(task.assigned_to_emails ?? []).length > 0 && (
                <Badge variant="neutral">Assigned to {assigneeNames}</Badge>
              )}
            </div>
          </div>
          <button className="task-drawer__close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSave} className="task-drawer__body">
          {error && <div className="login-form__error"><span>{error}</span></div>}

          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              required
              maxLength={255}
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              rows={5}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                disabled={!canChangeStatus}
              >
                <option value="ToDo">To Do</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
              </Select>
            </Field>
            <Field label="Due">
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>

          {!canEdit && !canChangeStatus && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              You have view access only. Only the creator or assignee can modify this task.
            </p>
          )}

          <div className="task-drawer__footer">
            {canEdit && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={deleteMut.isPending}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              {(canEdit || canChangeStatus) && (
                <Button type="submit" variant="primary" loading={updateMut.isPending}>
                  Save
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </Drawer>
  );
}
