import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';

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
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorExportResult>;
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(errorMessageFromBody(json, `Failed to export video (${res.status})`));
  }
  return json.data;
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
  const es = new EventSource(`${base}/api/v1/video-editor/workspace/stream`, {
    withCredentials: true,
  });
  es.addEventListener('status', (ev: MessageEvent<string>) => {
    if (ev.data) handlers.onStatus(ev.data);
  });
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      handlers.onError('Workspace SSE connection closed');
    }
  };
  return () => {
    try {
      es.close();
    } catch {
      // ignore
    }
  };
}
