import { request } from '../lib/fetcher';
import type { CalendarEvent, EventType, Scope } from '../types/api';

export interface CalendarEventCreateInput {
  title: string;
  description?: string;
  event_type: EventType;
  location?: string;
  starts_at: string;
  ends_at?: string | null;
}

export type CalendarEventUpdateInput = Partial<CalendarEventCreateInput>;

export async function listCalendarEvents(window?: {
  starts_after?: string;
  starts_before?: string;
}): Promise<CalendarEvent[]> {
  return request<CalendarEvent[]>('/calendar/events/', { query: window });
}

export async function listScopeCalendarEvents(
  scope: Scope,
  scopeId: number,
): Promise<CalendarEvent[]> {
  return request<CalendarEvent[]>(`/${scope}/${scopeId}/calendar/events/`);
}

export async function createScopeCalendarEvent(
  scope: Scope,
  scopeId: number,
  input: CalendarEventCreateInput,
): Promise<CalendarEvent> {
  return request<CalendarEvent>(`/${scope}/${scopeId}/calendar/events/`, {
    method: 'POST',
    body: input,
  });
}

export async function getCalendarEvent(id: number): Promise<CalendarEvent> {
  return request<CalendarEvent>(`/calendar/events/${id}/`);
}

export async function updateCalendarEvent(
  id: number,
  input: CalendarEventUpdateInput,
): Promise<CalendarEvent> {
  return request<CalendarEvent>(`/calendar/events/${id}/`, {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  await request<null>(`/calendar/events/${id}/`, {
    method: 'DELETE',
    expectNoContent: true,
  });
}
