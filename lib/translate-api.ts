import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';

export type TranslateResult = {
  translatedText: string;
  translatedFrom?: string | null;
  translatedTo?: string | null;
  style?: string | null;
  usedProvider?: string | null;
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

/**
 * Synchronous translate via main-service → ai-service (`POST /api/v1/ai/translate`).
 * Uses Bearer + cookies like transcribe.
 */
export async function translateText(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  style?: string;
}): Promise<TranslateResult> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const body: Record<string, string> = {
    text: params.text,
    sourceLanguage: params.sourceLanguage.trim(),
    targetLanguage: params.targetLanguage.trim(),
  };
  if (params.style?.trim()) {
    body.style = params.style.trim();
  }

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/translate`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<TranslateResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Translate failed (${res.status})`));
  }
  if (typeof json.data.translatedText !== 'string') {
    throw new Error('Translate response missing text');
  }
  return json.data;
}

export async function translateEstimatePoints(text: string): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/translate/estimate`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ text }),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Estimate failed (${res.status})`));
  }
  return json.data;
}

export function translateLiveEnabled(): boolean {
  return Boolean(getPublicApiBaseUrl());
}
