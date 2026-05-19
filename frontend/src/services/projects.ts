import { request } from '../lib/fetcher';
import type { Invitation, Project } from '../types/api';

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

export async function inviteToProject(
  projectId: number,
  input: { email: string; role: 'PROJECT_LEAD' | 'MEMBER'; expires_at?: string },
): Promise<Invitation> {
  return request<Invitation>(`/projects/${projectId}/invite/`, {
    method: 'POST',
    body: input,
  });
}
