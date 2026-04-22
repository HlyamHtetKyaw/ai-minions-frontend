import { getPublicApiBaseUrl } from '@/lib/api-base';
import { authHeaders, errorMessageFromBody, fetchInit, fetchWithAuthRetry } from '@/lib/api-auth-fetch';

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export type VideoEditorWorkspaceSnapshot = {
  workspaceJson: string;
  source: string;
};

export type VideoEditorUploadUrl = {
  uploadUrl: string;
  /** Object key (main-service field name: s3Key). */
  s3Key: string;
  /** Browser fetch URL (main-service field name: storageUrl; may be a presigned HTTPS URL). */
  storageUrl: string;
};

export async function videoEditorGetWorkspace(): Promise<VideoEditorWorkspaceSnapshot> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshot>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `video-editor workspace fetch failed (${res.status})`));
  }
  return json.data;
}

export async function videoEditorSaveSnapshot(workspaceJson: string): Promise<VideoEditorWorkspaceSnapshot> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/snapshot`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ workspaceJson }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshot>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `video-editor snapshot save failed (${res.status})`));
  }
  return json.data;
}

export async function videoEditorClearWorkspace(): Promise<void> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace`, {
    ...fetchInit,
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(errorMessageFromBody(json, `video-editor workspace clear failed (${res.status})`));
  }
}

export async function videoEditorPrepareUploadUrl(
  fileName: string,
  contentType: string,
): Promise<VideoEditorUploadUrl> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/upload-url`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ fileName, contentType }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorUploadUrl>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `video-editor upload-url failed (${res.status})`));
  }
  return json.data;
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  opts?: { contentType?: string },
): Promise<void> {
  const contentType = opts?.contentType || file.type || 'application/octet-stream';
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Storage upload failed: ${res.status} ${text}`.trim());
  }
}

export type WorkspaceExportResponse = {
  storageUrl: string;
  readUrl: string;
  key: string;
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

export async function videoEditorExportWorkspace(payload: unknown): Promise<WorkspaceExportResponse> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/export`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ payload }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<WorkspaceExportResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `video export failed (${res.status})`));
  }
  return json.data;
}

export async function videoEditorExportEstimateExisting(s3Key: string): Promise<PointsEstimate> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/video-editor/workspace/export/estimate-existing`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ s3Key }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<PointsEstimate>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `export estimate failed (${res.status})`));
  }
  return json.data;
}

