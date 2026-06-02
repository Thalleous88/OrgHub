import { request, setTokens, clearTokens, getAccessToken } from '../lib/fetcher';
import type { CurrentUser, Profile } from '../types/api';

export { getAccessToken };

interface AuthTokens {
  access: string;
  refresh: string;
}

interface RegisterResponse extends AuthTokens {
  id: number;
  email: string;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const data = await request<AuthTokens>('/auth/login/', {
    method: 'POST',
    body: { email, password },
    anon: true,
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function register(email: string, password: string): Promise<RegisterResponse> {
  const data = await request<RegisterResponse>('/auth/register/', {
    method: 'POST',
    body: { email, password },
    anon: true,
  });
  setTokens(data.access, data.refresh);
  return data;
}

export function logout(): void {
  clearTokens();
}

export function hasSession(): boolean {
  return Boolean(getAccessToken());
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me/');
}

export async function getProfile(): Promise<Profile> {
  return request<Profile>('/auth/profile/');
}

export async function updateProfile(values: Partial<Profile>): Promise<Profile> {
  return request<Profile>('/auth/profile/', {
    method: 'PATCH',
    body: values,
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await request('/auth/change-password/', {
    method: 'POST',
    body: { old_password: oldPassword, new_password: newPassword, confirm_password: newPassword },
  });
}
