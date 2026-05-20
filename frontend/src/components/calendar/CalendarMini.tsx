import type { CalendarEvent } from '../../types/api';
import './CalendarMini.css';

interface Props {
  events: CalendarEvent[];
  emptyText?: string;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarMini({ events, emptyText = 'No upcoming events' }: Props) {
  if (events.length === 0) {
    return <div className="ui-empty">{emptyText}</div>;
  }
  return (
    <div className="cal-mini">
      {events.map((e) => {
        const date = new Date(e.starts_at);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const cls =
          e.event_type === 'MEETING'
            ? 'cal-mini__type--meeting'
            : e.event_type === 'MILESTONE'
            ? 'cal-mini__type--milestone'
            : 'cal-mini__type--event';
        return (
          <div key={e.id} className="cal-mini__item">
            <div className="cal-mini__date">
              <span className="cal-mini__date-month">{month}</span>
              <span className="cal-mini__date-day">{day}</span>
            </div>
            <div className="cal-mini__body">
              <div className="cal-mini__title">{e.title}</div>
              <div className="cal-mini__meta">
                {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}
                {e.location ? ` · ${e.location}` : ''}
              </div>
            </div>
            <span className={`cal-mini__type ${cls}`}>{e.event_type}</span>
          </div>
        );
      })}
    </div>
  );
}
