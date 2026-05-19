import type { DashboardTask } from '../services/api';
import './DeadlineCard.css';

interface DeadlineCardProps {
  tasks: DashboardTask[];
}

function getUrgencyInfo(dueAt: string | null): { label: string; className: string } {
  if (!dueAt) return { label: 'No due date', className: 'deadline-tag--normal' };
  const now = new Date();
  const due = new Date(dueAt);
  const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) return { label: 'Overdue', className: 'deadline-tag--overdue' };
  if (hoursLeft < 24) return { label: 'Urgent', className: 'deadline-tag--urgent' };
  if (hoursLeft < 72) {
    const days = Math.ceil(hoursLeft / 24);
    return { label: `${days} day${days > 1 ? 's' : ''} left`, className: 'deadline-tag--soon' };
  }
  const days = Math.ceil(hoursLeft / 24);
  return { label: `${days} days left`, className: 'deadline-tag--normal' };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DeadlineCard({ tasks }: DeadlineCardProps) {
  const pendingTasks = tasks
    .filter((t) => t.status !== 'Done')
    .sort((a, b) => {
      // Tasks without a due date sink to the bottom.
      const aTime = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })
    .slice(0, 5);

  return (
    <div className="deadline-card glass-card animate-fade-in-up delay-2" id="deadline-widget">
      <div className="deadline-card__header">
        <h3 className="deadline-card__title">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="var(--teal-400)" strokeWidth="1.5"/>
            <path d="M9 5v4l3 2" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Upcoming Personal Deadlines
        </h3>
        <span className="deadline-card__count">{pendingTasks.length} TASKS</span>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="deadline-card__empty">
          <p>No pending deadlines — you're all caught up! 🎉</p>
        </div>
      ) : (
        <ul className="deadline-card__list">
          {pendingTasks.map((task) => {
            const urgency = getUrgencyInfo(task.due_at);
            return (
              <li key={task.id} className="deadline-item">
                <div className={`deadline-item__dot ${task.status === 'InProgress' ? 'deadline-item__dot--active' : ''}`} />
                <div className="deadline-item__content">
                  <span className="deadline-item__title">{task.title}</span>
                  <span className="deadline-item__meta">
                    {task.project ? 'Project' : 'Division'} • {formatDate(task.due_at)}
                  </span>
                </div>
                <span className={`deadline-tag ${urgency.className}`}>{urgency.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
