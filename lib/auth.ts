import { apiFetch } from "./api";
import {
  setSessionHintCookie,
  setStoredAccessToken,
} from "./auth-token";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

function persistTokensFromAuthResponse(body: unknown) {
  if (!body || typeof body !== "object") return;
  const data = (body as ApiEnvelope<{ accessToken?: string }>).data;
  const token =
    data && typeof data.accessToken === "string" ? data.accessToken : undefined;
  if (token) {
    setStoredAccessToken(token);
    setSessionHintCookie();
  }
}

export async function signup(username: string, email: string, password: string) {
  return apiFetch("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login(usernameOrEmail: string, password: string) {
  const body = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ usernameOrEmail, password }),
  });
  persistTokensFromAuthResponse(body);
  return body;
}

/** Passwordless login using the access code issued when an admin provisions your account. */
export async function loginWithCode(code: string) {
  const body = await apiFetch("/api/v1/auth/login-with-code", {
    method: "POST",
    body: JSON.stringify({ code: code.trim() }),
  });
  persistTokensFromAuthResponse(body);
  return body;
}

export type MeUser = {
  userId: number;
  username: string;
  email: string;
  role: string;
  displayName?: string;
  creditBalance?: number;
};

export async function fetchMe(): Promise<MeUser | null> {
  try {
    const raw = await apiFetch("/api/v1/auth/me");
    if (!raw || typeof raw !== "object") return null;
    const env = raw as ApiEnvelope<MeUser>;
    if (!env.success || env.data == null) return null;
    return env.data;
  } catch {
    return null;
  }
}
