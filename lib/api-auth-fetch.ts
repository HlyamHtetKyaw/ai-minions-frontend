import { getPublicApiBaseUrl } from '@/lib/api-base';
import { getStoredAccessToken, setSessionHintCookie, setStoredAccessToken } from '@/lib/auth-token';
import { detectCurrentLocale, getDefaultErrorMessage, getStatusErrorMessage } from '@/lib/api-error-message';

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

/** Always returns locale-aware fixed messages by response status. */
export function errorMessageFromBody(_: unknown, fallback: string): string {
  const statusMatch = fallback.match(/\((\d{3})\)/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (Number.isFinite(status)) {
      return getStatusErrorMessage(status, detectCurrentLocale());
    }
  }
  return getDefaultErrorMessage(detectCurrentLocale());
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

/**
 * One-time OAuth handoff: exchanges an opaque id from the Google redirect URL for JWTs in JSON.
 * Use when the API and frontend are on different origins (refresh cookies are not sent cross-site).
 */
export async function tryExchangeGoogleSession(exchange: string): Promise<boolean> {
  const id = exchange.trim();
  if (!id) return false;
  const base = getPublicApiBaseUrl();
  if (!base) return false;
  const res = await fetch(`${base}/api/v1/auth/google/session`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ exchange: id }),
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
