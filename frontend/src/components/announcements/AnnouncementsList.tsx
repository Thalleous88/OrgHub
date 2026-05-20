import { Badge, Button, EmptyState } from '../ui';
import { useDeleteAnnouncement } from '../../hooks/queries/useAnnouncements';
import type { Announcement, AnnouncementPriority } from '../../types/api';

interface Props {
  announcements: Announcement[];
  canManage?: boolean | ((announcement: Announcement) => boolean);
}

const priorityVariant: Record<AnnouncementPriority, 'teal' | 'amber' | 'red' | 'neutral'> = {
  LOW: 'neutral',
  NORMAL: 'teal',
  HIGH: 'red',
};

function isManageable(
  canManage: Props['canManage'],
  announcement: Announcement,
): boolean {
  if (typeof canManage === 'function') return canManage(announcement);
  return Boolean(canManage);
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export default function AnnouncementsList({ announcements, canManage }: Props) {
  const deleteMut = useDeleteAnnouncement();

  if (!announcements || announcements.length === 0) {
    return (
      <EmptyState
        title="No announcements yet"
        description="When announcements are posted, they'll appear here."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {announcements.map((a) => (
        <article
          key={a.id}
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md, 12px)',
            background: 'var(--surface-1, rgba(255,255,255,0.04))',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{a.title}</h3>
            <Badge variant={priorityVariant[a.priority] ?? 'neutral'}>{a.priority}</Badge>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatDate(a.created_at)}
            </span>
          </header>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
            {a.content}
          </p>
          <footer
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>By {a.created_by_email}</span>
            {isManageable(canManage, a) && (
              <Button
                variant="ghost"
                size="sm"
                loading={deleteMut.isPending && deleteMut.variables === a.id}
                onClick={() => {
                  if (window.confirm(`Delete announcement "${a.title}"?`)) {
                    deleteMut.mutate(a.id);
                  }
                }}
              >
                Delete
              </Button>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}
