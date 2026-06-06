import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, Button, Spinner, Select, Field } from '../../components/ui';
import CreateEventModal from '../../components/calendar/CreateEventModal';
import EventDetailModal from '../../components/calendar/EventDetailModal';
import { useCalendarWindow } from '../../hooks/queries/useCalendar';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { CalendarEvent, EventType, Scope } from '../../types/api';
import {
  type CalendarView,
  HOURS,
  addDays,
  addMonths,
  calendarMonthGridEnd,
  calendarMonthGridStart,
  endOfDay,
  endOfWeek,
  formatDay,
  formatMonth,
  formatWeekRange,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfWeek,
} from './dateHelpers';
import './CalendarPage.css';

function chipClass(type: EventType): string {
  if (type === 'MEETING') return 'cal-event-chip--meeting';
  if (type === 'MILESTONE') return 'cal-event-chip--milestone';
  return 'cal-event-chip--event';
}

function getEventColors(type: EventType): { bg: string; border: string; color: string } {
  if (type === 'MEETING') return { bg: 'var(--teal-glow)', border: 'var(--border-accent)', color: 'var(--teal-400)' };
  if (type === 'MILESTONE') return { bg: 'var(--violet-glow)', border: 'oklch(74% 0.13 300 / 0.3)', color: 'var(--violet-400)' };
  return { bg: 'oklch(84% 0.16 82 / 0.16)', border: 'oklch(84% 0.16 82 / 0.3)', color: 'var(--amber-400)' };
}

export default function CalendarPage() {
  const [params] = useSearchParams();
  const { memberships } = useWorkspace();
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const defaultScope = useMemo<{ scope: Scope; id: number; name: string } | null>(() => {
    const projLead = memberships.projects.find((p) => p.role === 'PROJECT_LEAD');
    if (projLead) return { scope: 'projects', id: projLead.id, name: projLead.name };
    const divHead = memberships.divisions.find((d) => d.role === 'DIVISION_HEAD');
    if (divHead) return { scope: 'divisions', id: divHead.id, name: divHead.name };
    const orgCore = memberships.organizations.find((o) => o.role === 'CORE_BOARD');
    if (orgCore) return { scope: 'organizations', id: orgCore.id, name: orgCore.name };
    return null;
  }, [memberships]);

  const [scopeChoice, setScopeChoice] = useState<string>(() =>
    defaultScope ? `${defaultScope.scope}:${defaultScope.id}` : '',
  );
  const allManagedScopes = useMemo(() => {
    const scopes: { value: string; label: string; scope: Scope; id: number; name: string }[] = [];
    memberships.organizations
      .filter((o) => o.role === 'CORE_BOARD')
      .forEach((o) =>
        scopes.push({
          value: `organizations:${o.id}`,
          label: `${o.name} (Org)`,
          scope: 'organizations',
          id: o.id,
          name: o.name,
        }),
      );
    memberships.divisions
      .filter((d) => d.role === 'DIVISION_HEAD')
      .forEach((d) =>
        scopes.push({
          value: `divisions:${d.id}`,
          label: `${d.name} (Div)`,
          scope: 'divisions',
          id: d.id,
          name: d.name,
        }),
      );
    memberships.projects
      .filter((p) => p.role === 'PROJECT_LEAD')
      .forEach((p) =>
        scopes.push({
          value: `projects:${p.id}`,
          label: `${p.name} (Proj)`,
          scope: 'projects',
          id: p.id,
          name: p.name,
        }),
      );
    return scopes;
  }, [memberships]);

  const selectedScope =
    allManagedScopes.find((s) => s.value === scopeChoice) ??
    (defaultScope ? allManagedScopes.find((s) => s.id === defaultScope.id) ?? null : null);

  const range = useMemo(() => {
    if (view === 'month') {
      return {
        starts_after: calendarMonthGridStart(cursor).toISOString(),
        starts_before: calendarMonthGridEnd(cursor).toISOString(),
      };
    }
    if (view === 'week') {
      return {
        starts_after: startOfWeek(cursor).toISOString(),
        starts_before: endOfWeek(cursor).toISOString(),
      };
    }
    return {
      starts_after: startOfDay(cursor).toISOString(),
      starts_before: endOfDay(cursor).toISOString(),
    };
  }, [view, cursor]);

  const { data: events = [], isLoading } = useCalendarWindow(range);

  useEffect(() => {
    const evParam = params.get('event');
    if (evParam && events.length) {
      const ev = events.find((e) => e.id === Number(evParam));
      if (ev) setCursor(new Date(ev.starts_at));
    }
  }, [events]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const navigatePrev = () => {
    if (view === 'month') setCursor(addMonths(cursor, -1));
    else if (view === 'week') setCursor(addDays(cursor, -7));
    else setCursor(addDays(cursor, -1));
  };
  const navigateNext = () => {
    if (view === 'month') setCursor(addMonths(cursor, 1));
    else if (view === 'week') setCursor(addDays(cursor, 7));
    else setCursor(addDays(cursor, 1));
  };
  const navigateToday = () => setCursor(new Date());

  const titleText =
    view === 'month' ? formatMonth(cursor) : view === 'week' ? formatWeekRange(cursor) : formatDay(cursor);

  const openCreate = (date?: Date) => {
    setCreateDate(date);
    setCreateOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="Calendar"
        subtitle="Meetings, events, and milestones across your organizations."
        actions={
          selectedScope ? (
            <Button variant="primary" onClick={() => openCreate()}>
              New event
            </Button>
          ) : undefined
        }
      />

      <div className="cal-toolbar">
        <div className="cal-toolbar__nav">
          <button className="cal-toolbar__navbtn" onClick={navigatePrev} aria-label="Previous">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="cal-toolbar__navbtn" onClick={navigateNext} aria-label="Next">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Button variant="ghost" size="sm" onClick={navigateToday}>Today</Button>
        </div>
        <div className="cal-toolbar__title">{titleText}</div>

        {allManagedScopes.length > 0 && (
          <div style={{ minWidth: 180 }}>
            <Field label={undefined}>
              <Select value={scopeChoice} onChange={(e) => setScopeChoice(e.target.value)}>
                {allManagedScopes.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <div className="cal-toolbar__viewgroup">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              className={`cal-toolbar__viewbtn ${view === v ? 'cal-toolbar__viewbtn--active' : ''}`}
              onClick={() => setView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : view === 'month' ? (
        <MonthView cursor={cursor} eventsByDay={eventsByDay} onCellClick={openCreate} onEventClick={setSelectedEvent} />
      ) : view === 'week' ? (
        <WeekView cursor={cursor} events={events} onCellClick={openCreate} onEventClick={setSelectedEvent} />
      ) : (
        <DayView cursor={cursor} events={events} onCellClick={openCreate} onEventClick={setSelectedEvent} />
      )}

      {selectedScope && (
        <CreateEventModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          scope={selectedScope.scope}
          scopeId={selectedScope.id}
          scopeName={selectedScope.name}
          defaultDate={createDate}
        />
      )}

      <EventDetailModal
        open={selectedEvent !== null}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </AppShell>
  );
}

function MonthView({
  cursor,
  eventsByDay,
  onCellClick,
  onEventClick,
}: {
  cursor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onCellClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const start = calendarMonthGridStart(cursor);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  const today = new Date();
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="cal-month">
      {weekdayNames.map((w) => (
        <div key={w} className="cal-month__dayname">{w}</div>
      ))}
      {cells.map((d) => {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const events = eventsByDay.get(key) ?? [];
        const inMonth = isSameMonth(d, cursor);
        const isToday = isSameDay(d, today);
        return (
          <div
            key={key}
            className={`cal-month__cell ${!inMonth ? 'cal-month__cell--out' : ''} ${isToday ? 'cal-month__cell--today' : ''}`}
            onClick={() => onCellClick(d)}
          >
            <span className="cal-month__num">{d.getDate()}</span>
            <div className="cal-month__events">
              {events.slice(0, 3).map((ev) => (
                <span
                  key={ev.id}
                  className={`cal-event-chip ${chipClass(ev.event_type)}`}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                >
                  {new Date(ev.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} {ev.title}
                </span>
              ))}
              {events.length > 3 && (
                <span className="cal-month__more">+{events.length - 3} more</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  cursor,
  events,
  onCellClick,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onCellClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="cal-week">
      <div className="cal-week__hour" />
      {days.map((d) => (
        <div
          key={`h-${d.toISOString()}`}
          className={`cal-week__col-head ${isSameDay(d, today) ? 'cal-week__col-head--today' : ''}`}
        >
          {d.toLocaleDateString('en-US', { weekday: 'short' })} {d.getDate()}
        </div>
      ))}

      {HOURS.map((hour) => (
        <Hour key={hour} hour={hour}>
          {days.map((d) => {
            const cellStart = new Date(d);
            cellStart.setHours(hour, 0, 0, 0);
            const cellEnd = new Date(d);
            cellEnd.setHours(hour, 59, 59, 999);
            const dayEvents = events.filter((e) => {
              const t = new Date(e.starts_at);
              return t >= cellStart && t <= cellEnd;
            });
            return (
              <div
                key={`${d.toISOString()}-${hour}`}
                className="cal-week__hour-cell"
                style={{ position: 'relative' }}
                onClick={() => onCellClick(cellStart)}
              >
                {dayEvents.map((ev) => {
                  const colors = getEventColors(ev.event_type);
                  return (
                    <div
                      key={ev.id}
                      className="cal-week__event"
                      style={{
                        top: 2,
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                        color: colors.color,
                      }}
                      title={ev.title}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    >
                      {ev.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Hour>
      ))}
    </div>
  );
}

function Hour({ hour, children }: { hour: number; children: React.ReactNode }) {
  const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  return (
    <>
      <div className="cal-week__hour">{label}</div>
      {children}
    </>
  );
}

function DayView({
  cursor,
  events,
  onCellClick,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onCellClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const today = new Date();
  return (
    <div className="cal-day">
      <div className="cal-day__hour" />
      <div className={`cal-day__col-head ${isSameDay(cursor, today) ? 'cal-day__col-head--today' : ''}`}>
        {cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </div>

      {HOURS.map((hour) => {
        const cellStart = new Date(cursor);
        cellStart.setHours(hour, 0, 0, 0);
        const cellEnd = new Date(cursor);
        cellEnd.setHours(hour, 59, 59, 999);
        const cellEvents = events.filter((e) => {
          const t = new Date(e.starts_at);
          return t >= cellStart && t <= cellEnd;
        });
        const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
        return (
          <DayHourRow key={hour} label={label}>
            <div
              className="cal-day__hour-cell"
              style={{ position: 'relative' }}
              onClick={() => onCellClick(cellStart)}
            >
              {cellEvents.map((ev) => {
                const colors = getEventColors(ev.event_type);
                return (
                  <div
                    key={ev.id}
                    className="cal-day__event"
                    style={{
                      top: 2,
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.color,
                    }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  >
                    {new Date(ev.starts_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {ev.title} {ev.location ? `· ${ev.location}` : ''}
                  </div>
                );
              })}
            </div>
          </DayHourRow>
        );
      })}
    </div>
  );
}

function DayHourRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="cal-week__hour">{label}</div>
      {children}
    </>
  );
}
