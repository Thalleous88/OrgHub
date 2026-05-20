import { request } from '../lib/fetcher';
import type { Announcement, AnnouncementPriority } from '../types/api';

export async function listAnnouncementFeed(): Promise<Announcement[]> {
  return request<Announcement[]>('/announcements/');
}

export async function listOrganizationAnnouncements(
  organizationId: number,
): Promise<Announcement[]> {
  return request<Announcement[]>(`/organizations/${organizationId}/announcements/`);
}

export async function createAnnouncement(
  organizationId: number,
  input: { title: string; content: string; priority: AnnouncementPriority },
): Promise<Announcement> {
  return request<Announcement>(`/organizations/${organizationId}/announcements/`, {
    method: 'POST',
    body: input,
  });
}

export async function deleteAnnouncement(announcementId: number): Promise<void> {
  await request<null>(`/announcements/${announcementId}/`, {
    method: 'DELETE',
    expectNoContent: true,
  });
}
