import { Modal, Badge, Button } from '../ui';
import type { CalendarEvent, EventType } from '../../types/api';

interface Props {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
}

const typeVariant: Record<EventType, 'teal' | 'amber' | 'neutral'> = {
  MEETING: 'teal',
  MILESTONE: 'neutral',
  EVENT: 'amber',
};

const typeLabel: Record<EventType, string> = {
  MEETING: 'Meeting',
  MILESTONE: 'Milestone',
  EVENT: 'Event',
};

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

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventDetailModal({ open, event, onClose }: Props) {
  if (!event) return null;

  const isUrl = event.location && /^https?:\/\//i.test(event.location);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event.title}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Badge variant={typeVariant[event.event_type]}>{typeLabel[event.event_type]}</Badge>
        </span>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="var(--text-muted)" strokeWidth="1.3"/>
            <path d="M2 6h12" stroke="var(--text-muted)" strokeWidth="1.3"/>
            <path d="M5 1v3M11 1v3" stroke="var(--text-muted)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span style={{ color: 'var(--text-secondary)' }}>
            {formatDate(event.starts_at)}
            {event.ends_at && ` — ${formatTime(event.ends_at)}`}
          </span>
        </div>

        {event.location && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" stroke="var(--text-muted)" strokeWidth="1.3"/>
              <circle cx="8" cy="6" r="2" stroke="var(--text-muted)" strokeWidth="1.3"/>
            </svg>
            {isUrl ? (
              <a href={event.location} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-400)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                {event.location}
              </a>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>{event.location}</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="5" r="3" stroke="var(--text-muted)" strokeWidth="1.3"/>
            <path d="M2 14a6 6 0 0112 0" stroke="var(--text-muted)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Organized by {event.created_by_email.split('@')[0]}
          </span>
        </div>

        {event.description && (
          <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-1, rgba(255,255,255,0.04))', border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {event.description}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
