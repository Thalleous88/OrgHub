import type { DashboardCalendarEvent } from '../services/api';
import './MeetingCard.css';

interface MeetingCardProps {
  events: DashboardCalendarEvent[];
}

function isLiveNow(event: DashboardCalendarEvent): boolean {
  const now = new Date();
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
  return now >= start && now <= end;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventTypeIcon(type: string) {
  if (type === 'MEETING') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M2 14a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    );
  }
  if (type === 'MILESTONE') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 14V3l9 4-9 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export default function MeetingCard({ events }: MeetingCardProps) {
  const todayEvents = events
    .filter((e) => {
      const eventDate = new Date(e.starts_at);
      const today = new Date();
      return (
        eventDate.getFullYear() === today.getFullYear() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getDate() === today.getDate()
      );
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <div className="meeting-card glass-card animate-fade-in-up delay-3" id="meeting-widget">
      <h3 className="meeting-card__title">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="4" width="14" height="12" rx="2" stroke="var(--teal-400)" strokeWidth="1.5"/>
          <path d="M2 8h14" stroke="var(--teal-400)" strokeWidth="1.5"/>
          <path d="M6 2v4M12 2v4" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Today's Meetings
      </h3>

      {todayEvents.length === 0 ? (
        <div className="meeting-card__empty">
          <p>No meetings scheduled for today</p>
        </div>
      ) : (
        <div className="meeting-card__list">
          {todayEvents.map((event) => {
            const live = isLiveNow(event);
            return (
              <div key={event.id} className={`meeting-item ${live ? 'meeting-item--live' : ''}`}>
                {live && (
                  <div className="meeting-item__live-badge">
                    <span className="meeting-item__live-dot" />
                    LIVE NOW
                  </div>
                )}
                <div className="meeting-item__header">
                  <span className="meeting-item__type-icon">
                    {getEventTypeIcon(event.event_type)}
                  </span>
                  <h4 className="meeting-item__title">{event.title}</h4>
                </div>
                <div className="meeting-item__details">
                  <span className="meeting-item__time">
                    {formatTime(event.starts_at)}
                    {event.ends_at && ` - ${formatTime(event.ends_at)}`}
                  </span>
                  {event.location && (
                    <>
                      <span className="meeting-item__sep">•</span>
                      <span className="meeting-item__location">{event.location}</span>
                    </>
                  )}
                </div>
                {event.description && (
                  <p className="meeting-item__desc">{event.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
