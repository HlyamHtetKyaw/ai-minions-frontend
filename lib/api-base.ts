/**
 * Main-service origin for browser fetch/EventSource.
 * Prefer {@link setServerApiBaseUrl} from the server page so .env.local is applied even when
 * tool routes were built with empty env (SSG + client bundle inlining).
 */
let serverInjected: string | undefined;

export function setServerApiBaseUrl(url: string | null | undefined): void {
  const t = (url ?? '').trim().replace(/\/$/, '');
  serverInjected = t === '' ? undefined : t;
}

export function getPublicApiBaseUrl(): string {
  if (serverInjected !== undefined && serverInjected !== '') {
    return serverInjected;
  }
  return (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}
