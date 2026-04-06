import { apiFetch } from "./api";
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

function unwrap<T>(raw: unknown): T {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid response");
  }
  const env = raw as ApiEnvelope<T>;
  if (!env.success || env.data === undefined) {
    throw new Error(
      typeof env.message === "string" ? env.message : "Request failed",
    );
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
    throw new Error(
      typeof env.message === "string" ? env.message : "Request failed",
    );
  }
}
