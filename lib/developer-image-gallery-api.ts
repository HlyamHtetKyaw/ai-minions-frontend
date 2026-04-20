import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  authHeaders,
  errorMessageFromBody,
  fetchInit,
  fetchWithAuthRetry,
} from '@/lib/api-auth-fetch';
import type { GalleryImage } from '@/store/editorStore';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type DeveloperImageGalleryDto = {
  id: number;
  name: string;
  imageUrl: string;
};

async function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = src;
  });
}

export async function fetchDeveloperGalleryImages(): Promise<GalleryImage[]> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('API base URL is not set');
  const res = await fetchWithAuthRetry(`${base}/api/v1/developer/image-gallery`, {
    ...fetchInit,
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<DeveloperImageGalleryDto[]>;
  if (!res.ok || !json.success || !Array.isArray(json.data)) {
    throw new Error(errorMessageFromBody(json, `Failed to fetch developer gallery (${res.status})`));
  }

  const images: GalleryImage[] = [];
  for (const row of json.data) {
    const src = typeof row.imageUrl === 'string' ? row.imageUrl.trim() : '';
    if (!src) continue;
    const size = await readImageSize(src);
    images.push({
      id: `db-${row.id}`,
      name: row.name?.trim() || `Image ${row.id}`,
      src,
      width: size.width,
      height: size.height,
      size: 0,
    });
  }
  return images;
}

