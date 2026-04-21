import { getStoredAccessToken } from "./auth-token";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getStoredAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
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
