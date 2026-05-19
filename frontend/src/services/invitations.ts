import { request } from '../lib/fetcher';
import type { Invitation } from '../types/api';

export async function acceptInvitation(token: string): Promise<Invitation> {
  return request<Invitation>('/invitations/accept/', {
    method: 'POST',
    body: { token },
  });
}
