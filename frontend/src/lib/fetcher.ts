import { ApiError, buildApiError } from './apiError';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

const ACCESS_KEY = 'orghub_access_token';
const REFRESH_KEY = 'orghub_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Skip auth for public endpoints. */
  anon?: boolean;
  /** Return the Response object instead of parsing JSON (e.g. file downloads). */
  raw?: boolean;
  /** Treat 204 No Content as null without parsing. */
  expectNoContent?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) return false;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (response.ok) {
        const data = (await response.json()) as { access: string };
        localStorage.setItem(ACCESS_KEY, data.access);
        return true;
      }
    } catch {
    }
    clearTokens();
    return false;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function buildUrl(endpoint: string, query?: RequestOptions['query']): string {
  const base = `${API_BASE}${endpoint}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function executeRequest(endpoint: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  const token = getAccessToken();
  if (token && !options.anon) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] ??= 'application/json';
    body = JSON.stringify(options.body);
  }

  return fetch(buildUrl(endpoint, options.query), {
    method: options.method ?? 'GET',
    headers,
    body,
  });
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  let response = await executeRequest(endpoint, options);

  if (response.status === 401 && !options.anon && getRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await executeRequest(endpoint, options);
    }
  }

  if (!response.ok) {
    throw await buildApiError(response, `Request failed (${response.status})`);
  }

  if (options.raw) {
    return response as unknown as T;
  }

  if (response.status === 204 || options.expectNoContent) {
    return null as T;
  }

  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, 'Server returned an unexpected response.');
  }
}

export const apiBaseUrl = API_BASE;
