import { request } from '../lib/fetcher';
import type { Invitation, InvitationRole, MemberItem, Organization } from '../types/api';

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

export async function leaveOrganization(organizationId: number): Promise<void> {
  return request<void>(`/organizations/${organizationId}/leave/`, {
    method: 'POST',
    expectNoContent: true,
  });
}

export async function listOrgMembers(organizationId: number): Promise<MemberItem[]> {
  return request<MemberItem[]>(`/organizations/${organizationId}/members/`);
}

export async function inviteToOrganization(
  organizationId: number,
  input: { emails: string[]; role: 'CORE_BOARD' | 'MEMBER'; expires_at?: string },
): Promise<Invitation[] | { invitations: Invitation[]; errors: unknown[] }> {
  return request('/organizations/' + organizationId + '/invite/', {
    method: 'POST',
    body: input,
  });
}

export type { InvitationRole };
