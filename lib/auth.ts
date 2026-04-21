import { apiFetch } from "./api";
import {
  setSessionHintCookie,
  setStoredAccessToken,
} from "./auth-token";

export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export type AuthTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  verified?: boolean;
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

export async function login(
  usernameOrEmail: string,
  password: string,
): Promise<ApiEnvelope<AuthTokenPayload>> {
  const body = (await apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ usernameOrEmail, password }),
  })) as ApiEnvelope<AuthTokenPayload>;
  persistTokensFromAuthResponse(body);
  return body;
}

/** Passwordless login using the access code issued when an admin provisions your account. */
export async function loginWithCode(
  code: string,
): Promise<ApiEnvelope<AuthTokenPayload>> {
  const body = (await apiFetch("/api/v1/auth/login-with-code", {
    method: "POST",
    body: JSON.stringify({ code: code.trim() }),
  })) as ApiEnvelope<AuthTokenPayload>;
  persistTokensFromAuthResponse(body);
  return body;
}

export async function verifyOtp(
  usernameOrEmail: string,
  otp: string,
): Promise<ApiEnvelope<AuthTokenPayload>> {
  const body = (await apiFetch("/api/v1/auth/otp-verify", {
    method: "POST",
    body: JSON.stringify({
      usernameOrEmail: usernameOrEmail.trim(),
      otp: otp.trim(),
    }),
  })) as ApiEnvelope<AuthTokenPayload>;
  persistTokensFromAuthResponse(body);
  return body;
}

/** Resend signup verification email (server + client cooldown). */
export async function resendOtp(
  usernameOrEmail: string,
): Promise<ApiEnvelope<void>> {
  return apiFetch("/api/v1/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ usernameOrEmail: usernameOrEmail.trim() }),
  }) as Promise<ApiEnvelope<void>>;
}

export type MeUser = {
  userId: number;
  username: string;
  email: string;
  role: string;
  displayName?: string;
  creditBalance?: number;
  /** False until OTP verification after password signup. */
  isVerified?: boolean;
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
