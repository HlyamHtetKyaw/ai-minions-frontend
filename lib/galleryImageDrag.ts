/** Custom MIME so `dragover` can detect gallery drags without reading payload. */
export const GALLERY_IMAGE_DRAG_MIME = 'application/x-ai-minions-gallery-image-id';

/** Fallback prefix for `text/plain` (Safari / older drag targets). */
export const GALLERY_IMAGE_DRAG_PREFIX = 'ai-minions-gallery:';

export function encodeGalleryImageDragPayload(galleryImageId: string) {
  return `${GALLERY_IMAGE_DRAG_PREFIX}${galleryImageId}`;
}

export function parseGalleryImageDragPayload(data: string): string | null {
  if (!data.startsWith(GALLERY_IMAGE_DRAG_PREFIX)) return null;
  const id = data.slice(GALLERY_IMAGE_DRAG_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
