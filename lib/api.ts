import { clearClientAuth, getStoredAccessToken } from "./auth-token";
import { getPublicApiBaseUrl } from "./api-base";
import {
  detectCurrentLocale,
  getNetworkErrorMessage,
  getStatusErrorMessage,
} from "./api-error-message";

function redirectToLoginOnUnauthorized() {
  if (typeof window === "undefined") return;
  clearClientAuth();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error(
      "API base URL is not set (set NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)",
    );
  }
  const token = getStoredAccessToken();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(getNetworkErrorMessage(detectCurrentLocale()));
  }

  if (!res.ok) {
    if (res.status === 401) {
      redirectToLoginOnUnauthorized();
    }
    throw new Error(getStatusErrorMessage(res.status, detectCurrentLocale()));
  }

  return res.json();
}
