import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';

export type VoiceOverResult = {
  audioUrl: string;
  audioBase64?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  style?: string | null;
  rawOutput?: string | null;
  usedProvider?: string | null;
  tokenIn?: number | null;
  tokenOut?: number | null;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type VoiceOverStartResult = {
  jobId: string;
};

export async function generateVoiceOver(params: {
  text: string;
  aiModel?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  style?: string;
  textLength?: string;
}): Promise<VoiceOverResult> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const body: Record<string, string> = {
    text: params.text,
  };
  if (params.aiModel?.trim()) body.aiModel = params.aiModel.trim();
  if (params.sourceLanguage?.trim()) body.sourceLanguage = params.sourceLanguage.trim();
  if (params.targetLanguage?.trim()) body.targetLanguage = params.targetLanguage.trim();
  if (params.style?.trim()) body.style = params.style.trim();
  if (params.textLength?.trim()) body.textLength = params.textLength.trim();

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/voice-over`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VoiceOverResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Voice over failed (${res.status})`));
  }
  if (typeof json.data.audioUrl !== 'string' || !json.data.audioUrl.trim()) {
    throw new Error('Voice over response missing audioUrl');
  }
  return json.data;
}

export async function startGenerateVoiceOver(params: {
  text: string;
  aiModel?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  style?: string;
  textLength?: string;
}): Promise<VoiceOverStartResult> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const body: Record<string, string> = {
    text: params.text,
  };
  if (params.aiModel?.trim()) body.aiModel = params.aiModel.trim();
  if (params.sourceLanguage?.trim()) body.sourceLanguage = params.sourceLanguage.trim();
  if (params.targetLanguage?.trim()) body.targetLanguage = params.targetLanguage.trim();
  if (params.style?.trim()) body.style = params.style.trim();
  if (params.textLength?.trim()) body.textLength = params.textLength.trim();

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/voice-over/start`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VoiceOverStartResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Voice over start failed (${res.status})`));
  }
  if (typeof json.data.jobId !== 'string' || !json.data.jobId.trim()) {
    throw new Error('Voice over start response missing jobId');
  }
  return json.data;
}

export type VoiceOverSseHandlers = {
  onStatus: (rawData: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onTerminal?: (payload: { status: 'completed' | 'failed' | 'error' | 'timeout'; data?: VoiceOverResult; message?: string }) => void;
};

export function openVoiceOverSse(jobId: string, handlers: VoiceOverSseHandlers): void {
  const base = getPublicApiBaseUrl();
  if (!base) {
    handlers.onError('API base URL is not set');
    handlers.onDone();
    return;
  }
  const path = `${base}/api/v1/ai/voice-over/stream/${jobId}`;
  let done = false;
  let es: EventSource | null = null;

  const finish = () => {
    if (done) return;
    done = true;
    try {
      es?.close();
    } catch {
      /* ignore */
    }
    handlers.onDone();
  };

  const handleRaw = (raw: string) => {
    handlers.onStatus(raw);
    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const status = String(payload.status ?? '').toLowerCase();
      if (status === 'completed' || status === 'failed' || status === 'error' || status === 'timeout') {
        handlers.onTerminal?.({
          status: status as 'completed' | 'failed' | 'error' | 'timeout',
          data: (payload.data ?? undefined) as VoiceOverResult | undefined,
          message: typeof payload.message === 'string' ? payload.message : undefined,
        });
        finish();
      }
    } catch {
      /* ignore non-json */
    }
  };

  es = new EventSource(path, { withCredentials: true });
  es.addEventListener('status', (ev: MessageEvent<string>) => {
    if (ev.data) handleRaw(ev.data);
  });
  es.onerror = () => {
    if (!done && es?.readyState === EventSource.CLOSED) {
      handlers.onError('SSE connection closed.');
      finish();
    }
  };
}

export function voiceOverLiveEnabled(): boolean {
  return Boolean(getPublicApiBaseUrl());
}
