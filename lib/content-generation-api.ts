import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import { consumeSseWithAuth } from '@/lib/sse-auth-fetch';

export type ContentGenerateV2Params = {
  topic: string;
  contentType: string;
  textLength?: 'short' | 'long';
  targetLanguage?: 'English' | 'Myanmar';
  outputMode: 'imageOnly' | 'imageAndText' | 'textOnly';
  tone: string;
  toonStyle?: string;
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

export type ContentGenerateV2StartResult = {
  jobId: string;
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
          message: typeof payload.message === 'string' ? payload.message : undefined,
        });
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
