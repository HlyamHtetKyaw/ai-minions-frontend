import { apiFetch } from "./api";
import { detectCurrentLocale, getDefaultErrorMessage } from "./api-error-message";
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export type MyProfile = {
  id: number;
  userId: number;
  memberLevelId: number | null;
  fullname: string | null;
  phoneNumber: string | null;
  geminiApiKey: string | null;
  openAiApiKey: string | null;
};

export type UsageHistoryStatus = "PENDING" | "SUCCESS" | "FAILED";
export type UsageHistoryFeatureKey = string;
export type UsageHistoryFeatureType = "TEXT" | "IMAGE" | "AUDIO" | "VIDEO" | string;

export type UsageHistoryItem = {
  id: number;
  featureKey: UsageHistoryFeatureKey;
  featureType: UsageHistoryFeatureType;
  chargedPoints: number;
  status: UsageHistoryStatus;
  createdAt: string;
};

export type UsageHistoryPage = {
  content: UsageHistoryItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
};

export type UsageHistoryDetailField = {
  label: string;
  value: string;
  kind: "text" | "audio" | string;
};

export type UsageHistoryDetail = {
  id: number;
  featureKey: UsageHistoryFeatureKey;
  status: UsageHistoryStatus;
  available: boolean;
  input: UsageHistoryDetailField[];
  output: UsageHistoryDetailField[];
};

function unwrap<T>(raw: unknown): T {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid response");
  }
  const env = raw as ApiEnvelope<T>;
  if (!env.success || env.data === undefined) {
    throw new Error(getDefaultErrorMessage(detectCurrentLocale()));
  }
  return env.data;
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const raw = await apiFetch("/api/v1/me/profile");
  return unwrap<MyProfile>(raw);
}

export async function updateMyProfile(body: {
  fullname: string;
  phoneNumber: string;
}): Promise<MyProfile> {
  const raw = await apiFetch("/api/v1/me/profile", {
    method: "PUT",
    body: JSON.stringify({
      fullname: body.fullname.trim(),
      phoneNumber: body.phoneNumber.trim(),
    }),
  });
  return unwrap<MyProfile>(raw);
}

export type MemberLevelActivationResult = {
  memberLevelCode: {
    id?: number;
    memberLevelId?: number | null;
    expiredAt?: string | null;
  };
  profile: MyProfile;
};

export async function activateMemberLevelCode(
  code: string,
): Promise<MemberLevelActivationResult> {
  const raw = await apiFetch("/api/v1/member-levels-codes/activate", {
    method: "POST",
    body: JSON.stringify({ code: code.trim() }),
  });
  return unwrap<MemberLevelActivationResult>(raw);
}

export async function activateTopupCode(
  code: string,
): Promise<{
  topupCode: { id?: number; points?: number; expiredAt?: string | null };
  addedPoints: number;
  creditBalance: number;
}> {
  const raw = await apiFetch("/api/v1/topup-codes/activate", {
    method: "POST",
    body: JSON.stringify({ code: code.trim() }),
  });
  return unwrap<{
    topupCode: { id?: number; points?: number; expiredAt?: string | null };
    addedPoints: number;
    creditBalance: number;
  }>(raw);
}

function isLikelyInvalidCodeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("invalid member level code") ||
    m.includes("invalid topup code") ||
    m.includes("invalid access code")
  );
}

export async function activateAnyCode(code: string): Promise<
  | { type: "member"; creditBalance?: number }
  | { type: "topup"; creditBalance: number }
> {
  try {
    await activateMemberLevelCode(code);
    return { type: "member", creditBalance: undefined };
  } catch (memberErr) {
    // Only fallback when first endpoint says code is invalid.
    if (!isLikelyInvalidCodeError(memberErr)) {
      throw memberErr;
    }
  }

  const topup = await activateTopupCode(code);
  return { type: "topup", creditBalance: topup.creditBalance };
}

export async function changePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const raw = await apiFetch("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const env = raw as ApiEnvelope<unknown>;
  if (!env.success) {
    throw new Error(getDefaultErrorMessage(detectCurrentLocale()));
  }
}

export async function fetchUsageHistory(params?: {
  page?: number;
  size?: number;
}): Promise<UsageHistoryPage> {
  const page = typeof params?.page === "number" ? Math.max(0, params.page) : 0;
  const size = typeof params?.size === "number" ? Math.max(1, Math.min(100, params.size)) : 10;
  const raw = await apiFetch(`/api/v1/auth/usage-history?page=${page}&size=${size}`);
  return unwrap<UsageHistoryPage>(raw);
}

export async function fetchUsageHistoryDetail(id: number): Promise<UsageHistoryDetail> {
  const raw = await apiFetch(`/api/v1/auth/usage-history/${id}`);
  return unwrap<UsageHistoryDetail>(raw);
}
