import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import { consumeSseWithAuth } from '@/lib/sse-auth-fetch';
import { notifyUserCreditBalanceRefresh } from '@/lib/user-credit-balance';
import type { PointsEstimate } from '@/lib/voice-over-api';

export type { PointsEstimate };

export type ContentGenerateV2Params = {
  topic: string;
  contentType: string;
  textLength?: 'short' | 'long';
  targetLanguage?: 'English' | 'Myanmar';
  outputMode: 'imageOnly' | 'imageAndText' | 'textOnly';
  tone: string;
  toonStyle?: string;
  logoUrl?: string;
  /** Legacy fallback for older backends; prefer `logoUrl`. */
  logoDataUrl?: string;
  aiOverlayTextEnabled?: boolean;
  userOverlayText?: string;
};

export type ContentGenerateV2Result = {
  generatedText: string;
  shortTextOnImage: string;
  imageBase64: string;
  storageUrl: string;
  s3Key: string;
};

/** Normalizes SSE/REST payload (camelCase or snake_case) for content v2 results. */
export function normalizeContentGenerateV2Result(raw: unknown): ContentGenerateV2Result {
  if (!raw || typeof raw !== 'object') {
    return { generatedText: '', shortTextOnImage: '', imageBase64: '', storageUrl: '', s3Key: '' };
  }
  const r = raw as Record<string, unknown>;
  const pick = (camel: string, snake: string): string => {
    const a = r[camel];
    const b = r[snake];
    if (typeof a === 'string' && a.length > 0) return a;
    if (typeof b === 'string' && b.length > 0) return b;
    return '';
  };
  return {
    generatedText: pick('generatedText', 'generated_text'),
    shortTextOnImage: pick('shortTextOnImage', 'short_text_on_image'),
    imageBase64: pick('imageBase64', 'image_base64'),
    storageUrl: pick('storageUrl', 'storage_url'),
    s3Key: pick('s3Key', 's3_key'),
  };
}

export type ContentGenerateV2StartResult = {
  jobId: string;
};

export type ContentLogoUploadUrlResult = {
  uploadUrl: string;
  s3Key: string;
  storageUrl: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export async function generateContentV2(params: ContentGenerateV2Params): Promise<ContentGenerateV2Result> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/content/v2`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<ContentGenerateV2Result>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Content generation failed (${res.status})`));
  }
  return json.data;
}

/** Same point model as content v2 generation reserve (topic, textLength, outputMode). */
export async function contentGenerationEstimatePoints(params: ContentGenerateV2Params): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/content/v2/estimate`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({
      topic: params.topic,
      contentType: params.contentType,
      textLength: params.textLength,
      targetLanguage: params.targetLanguage,
      outputMode: params.outputMode,
      tone: params.tone,
      toonStyle: params.toonStyle,
      logoUrl: params.logoUrl,
      logoDataUrl: params.logoDataUrl,
      aiOverlayTextEnabled: params.aiOverlayTextEnabled,
      userOverlayText: params.userOverlayText,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `content generation estimate failed (${res.status})`));
  }
  return json.data;
}

export async function startGenerateContentV2(params: ContentGenerateV2Params): Promise<ContentGenerateV2StartResult> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }

  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/content/v2/start`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<ContentGenerateV2StartResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Content generation start failed (${res.status})`));
  }
  return json.data;
}

export async function prepareContentLogoUploadUrl(fileName: string, contentType: string): Promise<ContentLogoUploadUrlResult> {
  const base = getPublicApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not set (NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)');
  }
  const res = await fetchWithAuthRetry(`${base}/api/v1/ai/content/v2/logo/upload-url`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      fileName,
      contentType,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<ContentLogoUploadUrlResult>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `content logo upload-url failed (${res.status})`));
  }
  return json.data;
}

export async function uploadContentLogoToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const contentType = file.type || 'application/octet-stream';
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Logo upload failed: ${res.status} ${text}`.trim());
  }
}

export type ContentGenerateSseHandlers = {
  onStatus: (rawData: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onTerminal?: (payload: { status: 'completed' | 'failed' | 'error' | 'timeout'; data?: ContentGenerateV2Result; message?: string }) => void;
};

export function openContentGenerationSse(jobId: string, handlers: ContentGenerateSseHandlers): void {
  const base = getPublicApiBaseUrl();
  if (!base) {
    handlers.onError('API base URL is not set');
    handlers.onDone();
    return;
  }
  const path = `${base}/api/v1/ai/content/v2/stream/${jobId}`;
  let done = false;
  let sawTerminal = false;
  let transportErrored = false;

  const finish = () => {
    if (done) return;
    done = true;
    handlers.onDone();
  };

  const handleRaw = (raw: string) => {
    handlers.onStatus(raw);
    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const status = String(payload.status ?? '').toLowerCase();
      if (status === 'completed' || status === 'failed' || status === 'error' || status === 'timeout') {
        sawTerminal = true;
        handlers.onTerminal?.({
          status: status as 'completed' | 'failed' | 'error' | 'timeout',
          data: (payload.data ?? undefined) as ContentGenerateV2Result | undefined,
          message: undefined,
        });
        if (status === 'completed') {
          notifyUserCreditBalanceRefresh();
        }
        finish();
      }
    } catch {
      /* ignore non-json */
    }
  };

  consumeSseWithAuth(path, {
    onEvent: (_eventName, data) => {
      if (done) return;
      handleRaw(data);
    },
    onError: (msg) => {
      if (done) return;
      transportErrored = true;
      handlers.onError(msg);
    },
    onClose: () => {
      if (done) return;
      if (!sawTerminal && !transportErrored) {
        handlers.onError('SSE connection closed.');
      }
      finish();
    },
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read logo file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read logo file'));
    reader.readAsDataURL(file);
  });
}
