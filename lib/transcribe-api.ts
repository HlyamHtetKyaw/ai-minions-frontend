import { getPublicApiBaseUrl } from '@/lib/api-base';
import { openGenerationJobSseStream, type GenerationJobSseHandlers } from '@/lib/generation-job-sse';
import { getStoredAccessToken, setSessionHintCookie, setStoredAccessToken } from '@/lib/auth-token';

/** Phase 1 — no job id until {@link transcribeCompleteUpload}. */
export type TranscribePrepareData = {
  uploadSessionId: string;
  uploadUrl: string;
  s3Key: string;
};

export type TranscribeCompleteData = {
  jobId: number;
  s3Key: string;
  storageUrl: string;
};

/** Matches main-service {@code GenerationStatus} codes. */
export const GENERATION_STATUS_PENDING = 1;
export const GENERATION_STATUS_SUCCESS = 2;
export const GENERATION_STATUS_FAILED = 3;

export type AiGenerationSnapshot = {
  status: number;
  outputData: string | null;
};

type ApiEnvelopeLoose<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

/**
 * Fetch current row from main-service (cookie auth). Used when SSE misses the terminal event (e.g. Redis mismatch)
 * or when the worker HTTP callback was skipped but you still need the transcript after setting WORKER_INTERNAL_TOKEN.
 */
export async function fetchAiGeneration(jobId: number): Promise<AiGenerationSnapshot | null> {
  const base = getPublicApiBaseUrl();
  if (!base) return null;
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai-generations/${jobId}`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelopeLoose<{ status?: number; outputData?: string | null }>;
  if (!res.ok || !json.success || json.data == null) {
    return null;
  }
  const d = json.data;
  return {
    status: typeof d.status === 'number' ? d.status : GENERATION_STATUS_PENDING,
    outputData: typeof d.outputData === 'string' ? d.outputData : null,
  };
}

/** Poll until SUCCESS (2), FAILED (3), or max attempts. */
export async function pollAiGenerationUntilTerminal(
  jobId: number,
  opts?: { maxAttempts?: number; intervalMs?: number },
): Promise<AiGenerationSnapshot | null> {
  const maxAttempts = opts?.maxAttempts ?? 45;
  const intervalMs = opts?.intervalMs ?? 2000;
  for (let i = 0; i < maxAttempts; i++) {
    const snap = await fetchAiGeneration(jobId);
    if (snap && (snap.status === GENERATION_STATUS_SUCCESS || snap.status === GENERATION_STATUS_FAILED)) {
      return snap;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

/** ApiResponse from GlobalExceptionHandler, or Spring ProblemDetail / error JSON. */
function errorMessageFromBody(json: unknown, fallback: string): string {
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
    if (typeof o.detail === 'string' && o.detail.trim()) return o.detail;
  }
  return fallback;
}

function inferSourceType(file: File): 'audio' | 'video' {
  const t = file.type.toLowerCase();
  if (t.startsWith('video/')) return 'video';
  return 'audio';
}

const fetchInit: RequestInit = { credentials: 'include' };

function authHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Uses refresh_token cookie when present; updates localStorage access token from JSON body.
 * Helps when the access JWT expired during a long upload or after a backend restart cleared Redis session
 * while cookies still carry a valid refresh token.
 */
async function tryRefreshAccessToken(): Promise<boolean> {
  const base = getPublicApiBaseUrl();
  if (!base) return false;
  const res = await fetch(`${base}/api/v1/auth/refresh`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
  });
  if (!res.ok) return false;
  const json = (await res.json().catch(() => ({}))) as ApiEnvelopeLoose<{ accessToken?: string }>;
  const token =
    json.data != null && typeof json.data === 'object' && typeof json.data.accessToken === 'string'
      ? json.data.accessToken
      : undefined;
  if (!token) return false;
  setStoredAccessToken(token);
  setSessionHintCookie();
  return true;
}

async function fetchWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 401) return res;
  const refreshed = await tryRefreshAccessToken();
  if (!refreshed) return res;
  const h = new Headers(init.headers as HeadersInit);
  const token = getStoredAccessToken();
  if (token) h.set('Authorization', `Bearer ${token}`);
  else h.delete('Authorization');
  return fetch(url, { ...init, headers: h });
}

/**
 * Uses HttpOnly cookies set by POST /auth/login (same-origin / CORS with credentials).
 */
export async function transcribePrepareUpload(file: File): Promise<TranscribePrepareData> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');

  const sourceType = inferSourceType(file);
  const contentType = file.type || (sourceType === 'video' ? 'video/mp4' : 'audio/mpeg');

  const res = await fetchWithAuthRetry(`${base}/api/v1/transcribe/upload-url`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      sourceType,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<TranscribePrepareData>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(
      errorMessageFromBody(json, `upload-url (prepare) failed (${res.status})`),
    );
  }
  return json.data;
}

/** Phase 2 — call after PUT to the presigned URL succeeds; returns {@code jobId} and publishes Redis job. */
export async function transcribeCompleteUpload(uploadSessionId: string): Promise<TranscribeCompleteData> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/transcribe/complete-upload`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ uploadSessionId }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<TranscribeCompleteData>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `complete-upload failed (${res.status})`));
  }
  return json.data;
}

export async function transcribeUploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const contentType = file.type || 'application/octet-stream';
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Storage upload failed: ${res.status} ${text}`.trim());
  }
}

export type TranscribeSseHandlers = GenerationJobSseHandlers;

/** @deprecated Prefer {@link openGenerationJobSseStream} from {@code @/lib/generation-job-sse}. */
export function transcribeOpenSse(jobId: number, handlers: TranscribeSseHandlers): void {
  openGenerationJobSseStream(jobId, handlers);
}

export function transcribeLiveEnabled(): boolean {
  return Boolean(getPublicApiBaseUrl());
}

export { openGenerationJobSseStream, type GenerationJobSseHandlers } from '@/lib/generation-job-sse';
