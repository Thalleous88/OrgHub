import type { DragEvent } from 'react';
import type { Task } from '../../types/api';
import { Badge } from '../ui';

interface UrgencyInfo {
  variant: 'red' | 'amber' | 'teal' | 'neutral';
  label: string;
}

function urgencyOf(due_at: string | null, status: Task['status']): UrgencyInfo | null {
  if (!due_at) return null;
  if (status === 'Done') return { variant: 'teal', label: 'Done' };
  const hours = (new Date(due_at).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 0) return { variant: 'red', label: 'Overdue' };
  if (hours < 24) return { variant: 'red', label: 'Due soon' };
  if (hours < 72) {
    const days = Math.ceil(hours / 24);
    return { variant: 'amber', label: `${days}d left` };
  }
  const days = Math.ceil(hours / 24);
  return { variant: 'neutral', label: `${days}d` };
}

function formatDue(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(email: string | null | undefined): string {
  if (!email) return '?';
  return email.split('@')[0].slice(0, 2).toUpperCase();
}

interface TaskCardProps {
  task: Task;
  draggable?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

export default function TaskCard({
  task,
  draggable,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const urgency = urgencyOf(task.due_at, task.status);

  return (
    <div
      className={`task-card ${isDragging ? 'task-card--dragging' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="task-card__title">{task.title}</div>
      <div className="task-card__meta">
        <span className="task-card__assignee">
          <span className="task-card__avatar">{initials(task.assigned_to_email)}</span>
          <span>{task.assigned_to_email?.split('@')[0] ?? 'Unassigned'}</span>
        </span>
        {task.due_at && <span>{formatDue(task.due_at)}</span>}
        {urgency && <Badge variant={urgency.variant}>{urgency.label}</Badge>}
      </div>
    </div>
  );
}
