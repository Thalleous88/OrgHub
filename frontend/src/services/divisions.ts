import { request } from '../lib/fetcher';
import type { Division, Invitation } from '../types/api';

export async function listDivisions(): Promise<Division[]> {
  return request<Division[]>('/divisions/');
}

export async function createDivision(input: {
  organization_id: number;
  name: string;
  description?: string;
}): Promise<Division> {
  return request<Division>('/divisions/', {
    method: 'POST',
    body: input,
  });
}

export async function inviteToDivision(
  divisionId: number,
  input: { email: string; role: 'DIVISION_HEAD' | 'MEMBER'; expires_at?: string },
): Promise<Invitation> {
  return request<Invitation>(`/divisions/${divisionId}/invite/`, {
    method: 'POST',
    body: input,
  });
}
