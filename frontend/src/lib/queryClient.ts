import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  currentUser: ['currentUser'] as const,
  profile: ['profile'] as const,
  dashboard: ['dashboard'] as const,
  organizations: ['organizations'] as const,
  orgMembers: (orgId: number) => ['organizations', orgId, 'members'] as const,
  divisions: ['divisions'] as const,
  divMembers: (divId: number) => ['divisions', divId, 'members'] as const,
  projects: ['projects'] as const,
  projMembers: (projId: number) => ['projects', projId, 'members'] as const,
  tasks: ['tasks'] as const,
  task: (id: number) => ['tasks', id] as const,
  calendar: (window?: { starts_after?: string; starts_before?: string }) =>
    ['calendar', window ?? {}] as const,
  calendarScope: (scope: 'organizations' | 'divisions' | 'projects', id: number) =>
    ['calendar', scope, id] as const,
  documents: (scope: 'organizations' | 'divisions' | 'projects', id: number) =>
    ['documents', scope, id] as const,
  announcementsFeed: ['announcements', 'feed'] as const,
  announcementsByOrg: (orgId: number) => ['announcements', 'org', orgId] as const,
  notifications: (filter?: 'all' | 'unread' | 'read') =>
    ['notifications', filter ?? 'all'] as const,
};
