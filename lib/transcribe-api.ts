import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import { openGenerationJobSseStream, type GenerationJobSseHandlers } from '@/lib/generation-job-sse';
import { notifyUserCreditBalanceRefresh } from '@/lib/user-credit-balance';

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

export type TranscribeFromExistingRequest = {
  s3Key: string;
  sourceType: 'audio' | 'video';
  contentType?: string | null;
  originalFileName?: string | null;
};

export type PointsEstimate = {
  baseCostPoints: number;
  reserveCostPoints: number;
  tokenIn: string | number;
  tokenOut: string | number;
  mbAudio: string | number;
  mbVideo: string | number;
  fileSizeBytes?: number | null;
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

function inferSourceType(file: File): 'audio' | 'video' {
  const t = file.type.toLowerCase();
  if (t.startsWith('video/')) return 'video';
  return 'audio';
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

export async function transcribeEstimatePoints(file: File): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');

  const sourceType = inferSourceType(file);
  const res = await fetchWithAuthRetry(`${base}/api/v1/transcribe/estimate`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      sourceType,
      fileSizeBytes: file.size,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `estimate failed (${res.status})`));
  }
  return json.data;
}

export async function transcribeEstimatePointsFromExisting(
  s3Key: string,
  sourceType: 'audio' | 'video',
): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');

  const res = await fetchWithAuthRetry(`${base}/api/v1/transcribe/estimate-existing`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ s3Key, sourceType }),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `estimate-existing failed (${res.status})`));
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
  notifyUserCreditBalanceRefresh();
  return json.data;
}

/** Start transcription from an already-uploaded object (no re-upload needed). */
export async function transcribeFromExisting(req: TranscribeFromExistingRequest): Promise<TranscribeCompleteData> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/transcribe/from-existing`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(req),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<TranscribeCompleteData>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `from-existing failed (${res.status})`));
  }
  notifyUserCreditBalanceRefresh();
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
