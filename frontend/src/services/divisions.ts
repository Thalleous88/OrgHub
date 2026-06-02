import { request } from '../lib/fetcher';
import type { Division, Invitation, MemberItem } from '../types/api';

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

export async function listDivisionMembers(divisionId: number): Promise<MemberItem[]> {
  return request<MemberItem[]>(`/divisions/${divisionId}/members/`);
}

export async function inviteToDivision(
  divisionId: number,
  input: { emails: string[]; role: 'DIVISION_HEAD' | 'MEMBER'; expires_at?: string },
): Promise<Invitation[] | { invitations: Invitation[]; errors: unknown[] }> {
  return request('/divisions/' + divisionId + '/invite/', {
    method: 'POST',
    body: input,
  });
}
