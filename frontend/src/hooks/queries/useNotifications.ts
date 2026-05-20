import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications';

export function useNotifications(filter: 'all' | 'unread' | 'read' = 'all') {
  return useQuery({
    queryKey: queryKeys.notifications(filter),
    queryFn: () => listNotifications(filter),
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
