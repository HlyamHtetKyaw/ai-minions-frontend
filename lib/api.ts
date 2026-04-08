import { getStoredAccessToken } from "./auth-token";
import { getPublicApiBaseUrl } from "./api-base";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error(
      "API base URL is not set (set NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)",
    );
  }
  const token = getStoredAccessToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({} as { message?: string }));
    const msg =
      typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return res.json();
}
