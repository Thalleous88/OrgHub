import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncementFeed,
  listOrganizationAnnouncements,
} from '../../services/announcements';
import type { AnnouncementPriority } from '../../types/api';

export function useAnnouncementFeed() {
  return useQuery({
    queryKey: queryKeys.announcementsFeed,
    queryFn: listAnnouncementFeed,
  });
}

export function useOrganizationAnnouncements(organizationId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.announcementsByOrg(organizationId ?? -1),
    queryFn: () => listOrganizationAnnouncements(organizationId as number),
    enabled: Boolean(organizationId),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      organizationId: number;
      input: { title: string; content: string; priority: AnnouncementPriority };
    }) => createAnnouncement(vars.organizationId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementsFeed });
      qc.invalidateQueries({ queryKey: queryKeys.announcementsByOrg(vars.organizationId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
