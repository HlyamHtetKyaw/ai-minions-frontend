import { uploadVideoEditorFile } from '@/lib/video-editor-workspace-api';
import type { GalleryImage } from '@/store/editorStore';

export function galleryImageRemoteSrc(storageUrl: string, s3Key: string): string {
  const base = storageUrl.trim();
  const key = s3Key.trim();
  if (!base) return '';
  if (!key) return base;
  if (base.includes('#wk=')) return base;
  return `${base}#wk=${encodeURIComponent(key)}`;
}

export type IngestGalleryImageHandlers = {
  addGalleryImage: (file: File) => Promise<GalleryImage>;
  setGalleryImageRemoteSrc: (galleryImageId: string, storageUrl: string) => void;
};

/** Local blob preview + presigned workspace upload (same flow as video editor gallery). */
export async function ingestWorkspaceGalleryFile(
  file: File,
  handlers: IngestGalleryImageHandlers,
): Promise<GalleryImage> {
  const added = await handlers.addGalleryImage(file);
  const prep = await uploadVideoEditorFile(file);
  if (prep.storageUrl?.trim()) {
    handlers.setGalleryImageRemoteSrc(
      added.id,
      galleryImageRemoteSrc(prep.storageUrl, prep.s3Key),
    );
  }
  return added;
}

export async function ingestWorkspaceGalleryFiles(
  files: FileList | File[],
  handlers: IngestGalleryImageHandlers,
): Promise<GalleryImage[]> {
  const list = Array.from(files);
  const added: GalleryImage[] = [];
  for (const file of list) {
    try {
      added.push(await ingestWorkspaceGalleryFile(file, handlers));
    } catch {
      // skip invalid / failed uploads
    }
  }
  return added;
}
