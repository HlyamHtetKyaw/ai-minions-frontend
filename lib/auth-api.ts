import { getPublicApiBaseUrl } from '@/lib/api-base';
import { detectCurrentLocale, getStatusErrorMessage } from '@/lib/api-error-message';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

function isBodyTokenLogin(data: unknown): data is { accessToken: string } {
  return (
    data != null &&
    typeof data === 'object' &&
    'accessToken' in data &&
    typeof (data as { accessToken?: unknown }).accessToken === 'string' &&
    Boolean((data as { accessToken: string }).accessToken)
  );
}

/**
 * POST /auth/login with credentials — API should set HttpOnly cookies when
 * {@code app.auth.cookie.enabled=true}. Verifies with GET /auth/me.
 */
export async function authLogin(usernameOrEmail: string, password: string): Promise<void> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');

  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password }),
  });

  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(getStatusErrorMessage(res.status, detectCurrentLocale()));
  }

  if (isBodyTokenLogin(json.data)) {
    throw new Error(
      'API returned JWTs in JSON (cookie auth is disabled). Enable app.auth.cookie.enabled=true on the main service, restart it, then sign in again — transcribe needs HttpOnly cookies.'
    );
  }

  const me = await fetch(`${base}/auth/me`, { credentials: 'include' });
  if (!me.ok) {
    throw new Error(
      'Login OK but cookies are not sent on the next request (GET /auth/me returned ' +
        me.status +
        '). Fixes: (1) APP_AUTH_COOKIE_ENABLED=true. (2) On http:// use APP_AUTH_COOKIE_SECURE=false. ' +
        '(3) APP_CORS_ALLOWED_ORIGINS must include your exact frontend URL (e.g. http://localhost:3000). ' +
        '(4) In DevTools → Application → Cookies, check that access_token exists for localhost after login.'
    );
  }
}

export async function authLogout(): Promise<void> {
  const base = getPublicApiBaseUrl();
  if (!base) return;
  await fetch(`${base}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
}
