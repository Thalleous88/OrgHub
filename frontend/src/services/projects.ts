import { request } from '../lib/fetcher';
import type { Invitation, MemberItem, Project } from '../types/api';

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>('/projects/');
}

export async function createProject(input: {
  division_id: number;
  name: string;
  description?: string;
}): Promise<Project> {
  return request<Project>('/projects/', {
    method: 'POST',
    body: input,
  });
}

export async function listProjectMembers(projectId: number): Promise<MemberItem[]> {
  return request<MemberItem[]>(`/projects/${projectId}/members/`);
}

export async function inviteToProject(
  projectId: number,
  input: { emails: string[]; role: 'PROJECT_LEAD' | 'MEMBER'; expires_at?: string },
): Promise<Invitation[] | { invitations: Invitation[]; errors: unknown[] }> {
  return request('/projects/' + projectId + '/invite/', {
    method: 'POST',
    body: input,
  });
}
