import { getPublicApiBaseUrl } from '@/lib/api-base';
import { videoEditorPrepareUploadUrl, uploadFileToPresignedUrl } from '@/lib/video-editor-api';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import { consumeSseWithAuth } from '@/lib/sse-auth-fetch';
import { notifyUserCreditBalanceRefresh } from '@/lib/user-credit-balance';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type VideoEditorWorkspaceSnapshotResult = {
  workspaceJson: string;
  state: string;
};

export type VideoEditorUploadUrlResult = {
  uploadUrl: string;
  s3Key: string;
  storageUrl: string;
};

function looksLikeExpiredPresignedUpload(status: number, responseText: string): boolean {
  if (status !== 400 && status !== 401 && status !== 403) {
    return false;
  }
  const body = responseText.toLowerCase();
  return (
    body.includes('expired') ||
    body.includes('request has expired') ||
    body.includes('signaturedoesnotmatch') ||
    body.includes('invalid signature') ||
    body.includes('x-amz-expires') ||
    body.includes('x-goog-expires') ||
    body.includes('token is expired')
  );
}

export type VideoEditorExportResult = {
  storageUrl: string;
  downloadUrl: string;
  s3Key: string;
  generationId?: number;
  status?: string;
};

export async function getVideoEditorWorkspace(): Promise<VideoEditorWorkspaceSnapshotResult> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshotResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Failed to fetch workspace (${res.status})`));
  }
  return json.data;
}

export async function saveVideoEditorWorkspaceSnapshot(
  workspaceJson: string,
): Promise<VideoEditorWorkspaceSnapshotResult> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/snapshot`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ workspaceJson }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshotResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Failed to cache workspace (${res.status})`));
  }
  return json.data;
}

export async function resetVideoEditorWorkspace(): Promise<VideoEditorWorkspaceSnapshotResult> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace`, {
    ...fetchInit,
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshotResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Failed to reset workspace (${res.status})`));
  }
  return json.data;
}

/**
 * Same presign + PUT sequence as viral shorts (`videoEditorPrepareUploadUrl` + `uploadFileToPresignedUrl`),
 * with one extra presign when the first PUT fails with an expired-signature style error.
 */
export async function uploadVideoEditorFile(file: File): Promise<VideoEditorUploadUrlResult> {
  const contentType = file.type || 'video/mp4';
  let prep = await videoEditorPrepareUploadUrl(file.name, contentType);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await uploadFileToPresignedUrl(prep.uploadUrl, file, { contentType });
      return { uploadUrl: prep.uploadUrl, s3Key: prep.s3Key, storageUrl: prep.storageUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const statusMatch = /^Storage upload failed: (\d+)/.exec(msg);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      const shouldRefreshPresign = attempt === 0 && looksLikeExpiredPresignedUpload(status, msg);
      if (shouldRefreshPresign) {
        prep = await videoEditorPrepareUploadUrl(file.name, contentType);
        continue;
      }
      throw err instanceof Error ? err : new Error(msg);
    }
  }
  throw new Error('Upload failed after retry');
}

export async function exportVideoEditorWorkspace(payload: unknown): Promise<VideoEditorExportResult> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/export`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ payload }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<Record<string, unknown>>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Failed to export video (${res.status})`));
  }
  const raw = json.data;
  const storageUrl = typeof raw.storageUrl === 'string' ? raw.storageUrl : '';
  const downloadUrl =
    typeof raw.downloadUrl === 'string'
      ? raw.downloadUrl
      : typeof raw.readUrl === 'string'
        ? raw.readUrl
        : '';
  const s3Key = typeof raw.s3Key === 'string' ? raw.s3Key : typeof raw.key === 'string' ? raw.key : '';
  const generationIdRaw =
    typeof raw.generationId === 'number' ? raw.generationId : Number.parseInt(String(raw.generationId ?? ''), 10);
  const generationId = Number.isFinite(generationIdRaw) ? generationIdRaw : undefined;
  const status = typeof raw.status === 'string' ? raw.status : undefined;
  if (generationId == null && !downloadUrl) {
    throw new Error('Failed to export video: missing generationId');
  }
  if (generationId == null) {
    notifyUserCreditBalanceRefresh();
  }
  return { storageUrl, downloadUrl, s3Key, generationId, status };
}

export type VideoEditorWorkspaceSseHandlers = {
  onStatus: (rawData: string) => void;
  onError: (message: string) => void;
};

export function openVideoEditorWorkspaceSse(handlers: VideoEditorWorkspaceSseHandlers): () => void {
  const base = getPublicApiBaseUrl();
  if (!base) {
    handlers.onError('API base URL is not set');
    return () => {};
  }
  const path = `${base}/api/v1/video-editor/workspace/stream`;
  let userAborted = false;
  let transportErrored = false;
  const abort = consumeSseWithAuth(path, {
    onEvent: (_eventName, data) => {
      handlers.onStatus(data);
    },
    onError: (message) => {
      if (!userAborted) {
        transportErrored = true;
        handlers.onError(message);
      }
    },
    onClose: () => {
      if (!userAborted && !transportErrored) {
        handlers.onError('Workspace SSE connection closed');
      }
    },
  });
  return () => {
    userAborted = true;
    abort();
  };
}
