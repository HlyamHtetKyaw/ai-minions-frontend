import { getPublicApiBaseUrl } from '@/lib/api-base';
import { authHeaders, errorMessageFromBody, fetchInit, fetchWithAuthRetry } from '@/lib/api-auth-fetch';
import type { VideoEditorWorkspaceSnapshot } from '@/lib/video-editor-api';

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export async function viralShortsGetWorkspace(): Promise<VideoEditorWorkspaceSnapshot> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/workspace`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshot>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `viral-shorts workspace fetch failed (${res.status})`));
  }
  return json.data;
}

export async function viralShortsSaveSnapshot(workspaceJson: string): Promise<VideoEditorWorkspaceSnapshot> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/workspace/snapshot`, {
    ...fetchInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ workspaceJson }),
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<VideoEditorWorkspaceSnapshot>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(errorMessageFromBody(json, `viral-shorts snapshot save failed (${res.status})`));
  }
  return json.data;
}

export async function viralShortsClearWorkspace(): Promise<void> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/viral-shorts/workspace`, {
    ...fetchInit,
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(errorMessageFromBody(body, `viral-shorts workspace clear failed (${res.status})`));
  }
}
