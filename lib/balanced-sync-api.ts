import { getPublicApiBaseUrl } from '@/lib/api-base';
import { authHeaders, errorMessageFromBody, fetchInit, fetchWithAuthRetry } from '@/lib/api-auth-fetch';

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export type BalancedSyncStartResponse = {
  generationId: number;
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

export async function balancedSyncEstimate(params: { videoS3Key: string; voiceOverS3Key: string }): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/balanced-sync/estimate`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `balanced-sync estimate failed (${res.status})`));
  }
  return json.data;
}

export async function balancedSyncStart(params: {
  videoS3Key: string;
  voiceOverS3Key: string;
  videoDurationSec: number;
  voiceDurationSec: number;
  protectFlip?: boolean;
  protectHueDeg?: number;
}): Promise<BalancedSyncStartResponse> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/balanced-sync/start`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<BalancedSyncStartResponse>;
  if (!res.ok || !json.success || !json.data?.generationId) {
    throw new Error(errorMessageFromBody(json, `balanced-sync start failed (${res.status})`));
  }
  return json.data;
}

export async function balancedSyncAccept(params: {
  originalVideoS3Key: string;
  voiceOverS3Key: string;
  balancedVideoS3Key: string;
}): Promise<void> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/balanced-sync/accept`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<string>;
  if (!res.ok || !json.success) {
    throw new Error(errorMessageFromBody(json, `balanced-sync accept failed (${res.status})`));
  }
}

export async function balancedSyncReject(params: { balancedVideoS3Key: string }): Promise<void> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/balanced-sync/reject`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<string>;
  if (!res.ok || !json.success) {
    throw new Error(errorMessageFromBody(json, `balanced-sync reject failed (${res.status})`));
  }
}

