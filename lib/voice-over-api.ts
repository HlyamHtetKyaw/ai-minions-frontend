import { getPublicApiBaseUrl } from '@/lib/api-base';
import { authHeaders, errorMessageFromBody, fetchInit, fetchWithAuthRetry } from '@/lib/api-auth-fetch';
import { consumeSseWithAuth } from '@/lib/sse-auth-fetch';
import { notifyUserCreditBalanceRefresh } from '@/lib/user-credit-balance';

export type PointsEstimate = {
  baseCostPoints: number;
  reserveCostPoints: number;
  tokenIn: string | number;
  tokenOut: string | number;
  mbAudio: string | number;
  mbVideo: string | number;
  /** Voice-over / TTS workload units (when returned by voice-over estimate). */
  voiceOverTokenUnits?: string | number | null;
  fileSizeBytes?: number | null;
};

export type VoiceOverStartResponse = {
  jobId: string;
};

/** Gemini TTS catalog entry from GET /api/v1/ai/voice-over/models */
export type VoiceModelDescriptor = {
  id: string;
  style: string;
};

export type VoiceOverProviderModels = {
  provider: string;
  models: VoiceModelDescriptor[];
};

export type VoiceOverModelsResponse = {
  providers: VoiceOverProviderModels[];
};

/**
 * Maps persisted workspace values to a Gemini {@code aiModel} id.
 * Legacy {@code woman-kore} / {@code man} are normalized to API voice names.
 */
export function normalizePersistedVoiceId(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'woman-kore' || v === '') return 'kore';
  if (v === 'man') return 'charon';
  return v;
}

export async function fetchVoiceOverModels(): Promise<VoiceOverModelsResponse> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/voice-over/models`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VoiceOverModelsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `voice-over models failed (${res.status})`));
  }
  return json.data;
}

export type VoiceOverResult = {
  audioUrl?: string | null;
  s3Key?: string | null;
  audioBase64?: string | null;
  usedProvider?: string | null;
  tokenIn?: number | null;
  tokenOut?: number | null;
};

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export async function voiceOverEstimatePoints(text: string): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/voice-over/estimate`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `voice-over estimate failed (${res.status})`));
  }
  return json.data;
}

export async function voiceOverStart(params: {
  text: string;
  /** Gemini prebuilt voice id (e.g. {@code kore}, {@code zephyr}). */
  aiModel: string;
  /** Script delivery tone for the voice-over pipeline (not the voice “style” label). */
  style?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  textLength?: string;
}): Promise<VoiceOverStartResponse> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const body: Record<string, unknown> = {
    text: params.text,
    aiModel: params.aiModel,
  };
  if (params.style != null) body.style = params.style;
  if (params.sourceLanguage != null) body.sourceLanguage = params.sourceLanguage;
  if (params.targetLanguage != null) body.targetLanguage = params.targetLanguage;
  if (params.textLength != null) body.textLength = params.textLength;
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/voice-over/start`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VoiceOverStartResponse>;
  if (!res.ok || !json.success || !json.data?.jobId) {
    throw new Error(errorMessageFromBody(json, `voice-over start failed (${res.status})`));
  }
  return json.data;
}

export function openVoiceOverSse(jobId: string, handlers: {
  onStatus: (raw: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onTerminal?: (payload: { status: string; message?: string; data?: unknown }) => void;
}): void {
  const base = getPublicApiBaseUrl();
  if (!base) {
    handlers.onError('API base URL is not set');
    handlers.onDone();
    return;
  }
  const path = `${base}/api/v1/ai/voice-over/stream/${encodeURIComponent(jobId)}`;
  let finished = false;
  let transportErrored = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    handlers.onDone();
  };

  const handlePayload = (raw: string) => {
    handlers.onStatus(raw);
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const s = String(o.status ?? '').toLowerCase();
      if (s === 'completed' || s === 'failed' || s === 'error' || s === 'timeout') {
        handlers.onTerminal?.({
          status: s,
          message: undefined,
          data: o.data,
        });
        if (s === 'completed') {
          notifyUserCreditBalanceRefresh();
        }
        finish();
      }
    } catch {
      /* ignore */
    }
  };

  consumeSseWithAuth(path, {
    onEvent: (_eventName, data) => {
      if (finished) return;
      handlePayload(data);
    },
    onError: (msg) => {
      if (finished) return;
      transportErrored = true;
      handlers.onError(msg);
    },
    onClose: () => {
      if (finished) return;
      if (!transportErrored) {
        handlers.onError('Voice over stream disconnected');
      }
      finish();
    },
  });
}

export async function voiceOverPresignRead(s3Key: string): Promise<string> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/voice-over/presign-read`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ s3Key }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<string>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `voice-over presign-read failed (${res.status})`));
  }
  return json.data;
}

