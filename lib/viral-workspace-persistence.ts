import type { BlurLayer, GalleryImage, ImageLayer, TextLayer } from '@/store/editorStore';
import type { LayerOrderEntry } from '@/features/viral-shorts/viral-overlay-store';

const LEGACY_NESTED_KEY = 'viralShortsWorkspace' as const;

function isBlobUrl(src: string): boolean {
  return typeof src === 'string' && src.startsWith('blob:');
}

/** Strip ephemeral blob URLs before saving viral workspace JSON. */
export function persistableViralOverlaySnapshot(payload: {
  textLayers: TextLayer[];
  blurLayers: BlurLayer[];
  galleryImages: GalleryImage[];
  imageLayers: ImageLayer[];
  layerOrder: LayerOrderEntry[];
}) {
  const safeGallery = payload.galleryImages.filter((g) => !isBlobUrl(g.src));
  const safeImages = payload.imageLayers
    .map((l) => {
      if (!isBlobUrl(l.src)) return l;
      const g = safeGallery.find((x) => x.id === l.galleryImageId);
      if (g != null) return { ...l, src: g.src };
      return l;
    })
    .filter((l) => !isBlobUrl(l.src));
  return {
    textLayers: payload.textLayers,
    blurLayers: payload.blurLayers,
    galleryImages: safeGallery,
    imageLayers: safeImages,
    layerOrder: payload.layerOrder,
  };
}

/**
 * Parse viral workspace JSON returned by {@code GET /api/v1/viral-shorts/workspace} (dedicated store).
 * Supports legacy nested shape if present in migrated payloads.
 */
export function parseViralWorkspacePayloadForRestore(raw: string): Record<string, unknown> | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '{}' || trimmed === 'null') return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const nested = parsed[LEGACY_NESTED_KEY];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const url = (nested as { videoUrl?: unknown }).videoUrl ?? (nested as { videoSrc?: unknown }).videoSrc;
      if (typeof url === 'string' && url.trim()) {
        return nested as Record<string, unknown>;
      }
    }
    const flatUrl = parsed.videoUrl ?? parsed.videoSrc;
    if (typeof flatUrl === 'string' && flatUrl.trim()) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
