import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import { notifyUserCreditBalanceRefresh } from '@/lib/user-credit-balance';

export type SubtitlesPrepareData = {
  uploadSessionId: string;
  uploadUrl: string;
  s3Key: string;
};

export type SubtitlesCompleteData = {
  jobId: number;
  s3Key: string;
  storageUrl: string;
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

export async function subtitlesPrepareUpload(file: File): Promise<SubtitlesPrepareData> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');

  const sourceType = inferSourceType(file);
  const contentType = file.type || (sourceType === 'video' ? 'video/mp4' : 'audio/mpeg');

  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/upload-url`, {
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
      targetLanguage: 'my',
      style: 'caption_rules_v1',
    }),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<SubtitlesPrepareData>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `subtitles upload-url failed (${res.status})`));
  }
  return json.data;
}

export async function subtitlesEstimatePoints(file: File): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  const sourceType = inferSourceType(file);
  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/estimate`, {
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
    throw new Error(errorMessageFromBody(json, `subtitles estimate failed (${res.status})`));
  }
  return json.data;
}

export async function subtitlesEstimatePointsFromExisting(params: {
  s3Key: string;
  sourceType: 'video' | 'audio';
}): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/estimate-existing`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `subtitles estimate-existing failed (${res.status})`));
  }
  return json.data;
}

export async function subtitlesFromExisting(params: {
  s3Key: string;
  sourceType: 'video' | 'audio';
  targetLanguage?: string;
  style?: string;
}): Promise<SubtitlesCompleteData> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/from-existing`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<SubtitlesCompleteData>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `subtitles from-existing failed (${res.status})`));
  }
  notifyUserCreditBalanceRefresh();
  return json.data;
}

export async function subtitlesCompleteUpload(uploadSessionId: string): Promise<SubtitlesCompleteData> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/complete-upload`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ uploadSessionId }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<SubtitlesCompleteData>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `subtitles complete-upload failed (${res.status})`));
  }
  notifyUserCreditBalanceRefresh();
  return json.data;
}

export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
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

export async function fetchSubtitleDownloadUrl(jobId: number): Promise<{ downloadUrl: string; srtKey: string }> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/${jobId}/download-url`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<{ downloadUrl: string; srtKey: string }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `download-url failed (${res.status})`));
  }
  return json.data;
}

export async function fetchSubtitleSrtText(jobId: number): Promise<{ srtText: string; srtKey: string; truncated: boolean }> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/subtitles/${jobId}/srt-text`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<{ srtText: string; srtKey: string; truncated: boolean }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `srt-text failed (${res.status})`));
  }
  return json.data;
}

