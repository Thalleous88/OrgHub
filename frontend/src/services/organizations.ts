import { request } from '../lib/fetcher';
import type { Invitation, InvitationRole, Organization } from '../types/api';

export async function listOrganizations(): Promise<Organization[]> {
  return request<Organization[]>('/organizations/');
}

export async function createOrganization(input: {
  name: string;
  description?: string;
}): Promise<Organization> {
  return request<Organization>('/organizations/', {
    method: 'POST',
    body: input,
  });
}

export async function inviteToOrganization(
  organizationId: number,
  input: { email: string; role: 'CORE_BOARD' | 'MEMBER'; expires_at?: string },
): Promise<Invitation> {
  return request<Invitation>(`/organizations/${organizationId}/invite/`, {
    method: 'POST',
    body: input,
  });
}

export type { InvitationRole };
