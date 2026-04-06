export const ACCESS_TOKEN_STORAGE_KEY = 'aiminions_access_token';

/** Fired on this window after access token is set or cleared (login / logout). */
export const AUTH_CHANGED_EVENT = 'aiminions-auth-changed';

/** Readable by Next.js middleware/layout on the app origin (not HttpOnly). */
export const SESSION_HINT_COOKIE = 'aiminions_auth';

function notifyAuthChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  notifyAuthChanged();
}

export function setSessionHintCookie(): void {
  if (typeof document === 'undefined') return;
  if (!getStoredAccessToken()) return;
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; max-age=${86400 * 7}; SameSite=Lax`;
}

export function clearSessionHintCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`;
}

export function clearClientAuth(): void {
  setStoredAccessToken(null);
  clearSessionHintCookie();
}
