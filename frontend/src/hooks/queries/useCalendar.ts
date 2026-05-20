import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  createScopeCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  listScopeCalendarEvents,
  updateCalendarEvent,
  type CalendarEventCreateInput,
  type CalendarEventUpdateInput,
} from '../../services/calendar';
import type { Scope } from '../../types/api';

export function useCalendarWindow(window?: {
  starts_after?: string;
  starts_before?: string;
}) {
  return useQuery({
    queryKey: queryKeys.calendar(window),
    queryFn: () => listCalendarEvents(window),
  });
}

export function useScopeCalendar(scope: Scope, scopeId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.calendarScope(scope, scopeId ?? -1),
    queryFn: () => listScopeCalendarEvents(scope, scopeId as number),
    enabled: Boolean(scopeId),
  });
}

export function useCreateScopeCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { scope: Scope; scopeId: number; input: CalendarEventCreateInput }) =>
      createScopeCalendarEvent(vars.scope, vars.scopeId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: queryKeys.calendarScope(vars.scope, vars.scopeId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CalendarEventUpdateInput }) =>
      updateCalendarEvent(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCalendarEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
