import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import { notifyUserCreditBalanceRefresh } from '@/lib/user-credit-balance';

export type TranslateResult = {
  translatedText: string;
  translatedFrom?: string | null;
  translatedTo?: string | null;
  style?: string | null;
  usedProvider?: string | null;
  /** Main-service ai_generation id (for refresh recovery via GET /api/v1/ai-generations/:id). */
  generationId?: number | null;
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

type TranslateBeginEnvelope = { generationId?: number };

function buildTranslateBody(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  style?: string;
}): Record<string, string> {
  const body: Record<string, string> = {
    text: params.text,
    sourceLanguage: params.sourceLanguage.trim(),
    targetLanguage: params.targetLanguage.trim(),
  };
  if (params.style?.trim()) {
    body.style = params.style.trim();
  }
  return body;
}

/**
 * Fast: creates a PENDING ai_generation row and returns its id **before** calling the model.
 * Persist this id, then call {@link translateExecute} so refresh-during-translate can recover via polling.
 */
export async function translateBegin(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  style?: string;
}): Promise<number> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/translate/begin`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(buildTranslateBody(params)),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<TranslateBeginEnvelope>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Translate begin failed (${res.status})`));
  }
  const raw = json.data.generationId;
  const id = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(id)) {
    throw new Error('Translate begin response missing generationId');
  }
  return id;
}

/** Runs the AI call for a row created by {@link translateBegin}. */
export async function translateExecute(generationId: number): Promise<TranslateResult> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/translate/execute/${generationId}`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<TranslateResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Translate execute failed (${res.status})`));
  }
  if (typeof json.data.translatedText !== 'string') {
    throw new Error('Translate response missing text');
  }
  notifyUserCreditBalanceRefresh();
  const genRaw = (json.data as { generationId?: unknown }).generationId;
  const gid =
    typeof genRaw === 'number' && Number.isFinite(genRaw) ? genRaw : Number.isFinite(Number(genRaw)) ? Number(genRaw) : null;
  return { ...json.data, generationId: gid != null && Number.isFinite(gid) ? gid : null };
}

/**
 * One-shot translate (begin + execute). Prefer {@link translateBegin} + {@link translateExecute} in the workspace
 * so the UI can persist {@code generationId} before the long HTTP call.
 */
export async function translateText(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  style?: string;
}): Promise<TranslateResult> {
  const id = await translateBegin(params);
  return translateExecute(id);
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
