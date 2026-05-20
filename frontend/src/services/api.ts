// OrgHub API Service Layer
// Handles all HTTP requests to the Django REST backend with JWT token management.

const API_BASE = 'http://localhost:8000/api';

// ─── Token Helpers ───────────────────────────────────────────
export function getAccessToken(): string | null {
  return localStorage.getItem('orghub_access_token');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('orghub_refresh_token');
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem('orghub_access_token', access);
  localStorage.setItem('orghub_refresh_token', refresh);
}

export function clearTokens(): void {
  localStorage.removeItem('orghub_access_token');
  localStorage.removeItem('orghub_refresh_token');
}

// ─── Fetch Wrapper ───────────────────────────────────────────
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON payloads (not FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, try to refresh the token once
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('orghub_access_token', data.access);
      return true;
    }
  } catch {
    // Refresh failed
  }

  clearTokens();
  return false;
}

// ─── Auth Endpoints ──────────────────────────────────────────
export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface UserProfile {
  full_name: string;
  major: string;
  campus_location: string;
}

export interface Membership {
  id: number;
  name: string;
  role: string;
  organization_id?: number;
  division_id?: number;
}

export interface CurrentUser {
  id: number;
  email: string;
  profile: UserProfile;
  memberships: {
    organizations: Membership[];
    divisions: Membership[];
    projects: Membership[];
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.non_field_errors?.[0] || 'Login failed. Please check your credentials.'
    );
  }

  const data: LoginResponse = await response.json();
  setTokens(data.access, data.refresh);
  return data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetchWithAuth('/auth/me/');

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
}

export function logout(): void {
  clearTokens();
}

// ─── Dashboard Endpoint ──────────────────────────────────────
export interface DashboardTask {
  id: number;
  division: number | null;
  project: number | null;
  title: string;
  description: string;
  status: 'ToDo' | 'InProgress' | 'Done';
  due_at: string | null;
  created_by: number;
  created_by_email: string;
  assigned_to: number | null;
  assigned_to_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardAnnouncement {
  id: number;
  organization: number;
  title: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  created_by: number;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardCalendarEvent {
  id: number;
  organization: number | null;
  division: number | null;
  project: number | null;
  calendar_scope: string;
  calendar_scope_id: number;
  title: string;
  description: string;
  event_type: 'EVENT' | 'MEETING' | 'MILESTONE';
  location: string;
  starts_at: string;
  ends_at: string | null;
  created_by: number;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardNotification {
  id: number;
  notification_type: 'TASK_REMINDER' | 'EVENT_REMINDER' | 'ANNOUNCEMENT';
  title: string;
  message: string;
  task: number | null;
  calendar_event: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardDocument {
  id: number;
  title: string;
  description: string;
  file: string;
  file_url: string;
  repository_scope: string;
  repository_id: number;
  organization: number | null;
  division: number | null;
  project: number | null;
  uploaded_by: number;
  uploaded_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface ManagementSummaryItem {
  id: number;
  name: string;
  role: string;
}

export interface DashboardData {
  profile: {
    id: number;
    email: string;
    full_name: string;
    major: string;
    campus_location: string;
  };
  memberships: {
    organizations: Membership[];
    divisions: Membership[];
    projects: Membership[];
  };
  tasks: {
    assigned_to_me: DashboardTask[];
    created_by_me: DashboardTask[];
    managed: DashboardTask[];
  };
  announcements: DashboardAnnouncement[];
  calendar_events: DashboardCalendarEvent[];
  notifications: DashboardNotification[];
  documents: DashboardDocument[];
  pending_invitations: unknown[];
  management_summary: {
    organizations: ManagementSummaryItem[];
    divisions: ManagementSummaryItem[];
    projects: ManagementSummaryItem[];
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const response = await fetchWithAuth('/dashboard/');

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  return response.json();
}

// ─── Notifications ───────────────────────────────────────────
export async function getNotifications(unreadOnly = false): Promise<DashboardNotification[]> {
  const query = unreadOnly ? '?is_read=false' : '';
  const response = await fetchWithAuth(`/notifications/${query}`);

  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  return response.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchWithAuth('/notifications/mark-all-read/', { method: 'POST' });
}
