import { getPublicApiBaseUrl } from '@/lib/api-base';
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

export async function prepareVideoEditorUploadUrl(
  fileName: string,
  contentType: string,
): Promise<VideoEditorUploadUrlResult> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/upload-url`, {
    ...fetchInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ fileName, contentType }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorUploadUrlResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Failed to prepare upload (${res.status})`));
  }
  return json.data;
}

export async function uploadVideoEditorFile(file: File): Promise<VideoEditorUploadUrlResult> {
  const prep = await prepareVideoEditorUploadUrl(file.name, file.type || 'application/octet-stream');
  const putRes = await fetch(prep.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }
  return prep;
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
