import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';

export type ContentGenerateV2Params = {
  topic: string;
  contentType: string;
  textLength?: 'short' | 'long';
  outputMode: 'imageOnly' | 'imageAndText';
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
