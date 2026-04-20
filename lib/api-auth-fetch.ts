import { getPublicApiBaseUrl } from '@/lib/api-base';
import { getStoredAccessToken, setSessionHintCookie, setStoredAccessToken } from '@/lib/auth-token';

export const fetchInit: RequestInit = { credentials: 'include' };

export function authHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ApiEnvelopeLoose<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

/** ApiResponse from GlobalExceptionHandler, or Spring ProblemDetail / error JSON. */
export function errorMessageFromBody(json: unknown, fallback: string): string {
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
    if (typeof o.detail === 'string' && o.detail.trim()) return o.detail;
  }
  return fallback;
}

/**
 * Uses refresh_token cookie when present; updates localStorage access token from JSON body.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  const base = getPublicApiBaseUrl();
  if (!base) return false;
  const res = await fetch(`${base}/api/v1/auth/refresh`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
  });
  if (!res.ok) return false;
  const json = (await res.json().catch(() => ({}))) as ApiEnvelopeLoose<{ accessToken?: string }>;
  const token =
    json.data != null && typeof json.data === 'object' && typeof json.data.accessToken === 'string'
      ? json.data.accessToken
      : undefined;
  if (!token) return false;
  setStoredAccessToken(token);
  setSessionHintCookie();
  return true;
}

export async function fetchWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 401) return res;
  const refreshed = await tryRefreshAccessToken();
  if (!refreshed) return res;
  const h = new Headers(init.headers as HeadersInit);
  const token = getStoredAccessToken();
  if (token) h.set('Authorization', `Bearer ${token}`);
  else h.delete('Authorization');
  return fetch(url, { ...init, headers: h });
}
