'use client';

import { useCallback, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ingestWorkspaceGalleryFiles } from '@/lib/ingest-workspace-gallery-image';
import { useViralOverlayStore } from '@/features/viral-shorts/viral-overlay-store';
import type { GalleryImage } from '@/store/editorStore';

const ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,.png,.jpg,.jpeg,.webp,.svg,.gif';

type ViralImageGalleryPanelProps = {
  canvasW: number;
  canvasH: number;
  onAddToCanvas: (img: GalleryImage) => void;
  onAddAsLogo?: (img: GalleryImage) => void;
};

export function ViralImageGalleryPanel({
  canvasW,
  canvasH,
  onAddToCanvas,
  onAddAsLogo,
}: ViralImageGalleryPanelProps) {
  const galleryImages = useViralOverlayStore((s) => s.galleryImages);
  const addGalleryImage = useViralOverlayStore((s) => s.addGalleryImage);
  const setGalleryImageRemoteSrc = useViralOverlayStore((s) => s.setGalleryImageRemoteSrc);
  const deleteGalleryImage = useViralOverlayStore((s) => s.deleteGalleryImage);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ingestHandlers = useCallback(
    () => ({
      addGalleryImage,
      setGalleryImageRemoteSrc,
    }),
    [addGalleryImage, setGalleryImageRemoteSrc],
  );

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setBusy(true);
      setUploadError(null);
      try {
        const results = await ingestWorkspaceGalleryFiles(list, ingestHandlers());
        if (list.length > 0 && results.length === 0) {
          setUploadError('Could not upload selected images. Try PNG, JPG, or WebP.');
        }
      } finally {
        setBusy(false);
      }
    },
    [ingestHandlers],
  );

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void ingestFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-violet-300/60 bg-violet-50/50 px-2 py-4 text-center dark:border-violet-500/30 dark:bg-violet-950/20"
      >
        <span className="text-[11px] font-medium text-foreground">Upload logo or image</span>
        <span className="text-[9px] text-muted-foreground">PNG · JPG · WebP · SVG</span>
        {busy ? <span className="text-[9px] text-muted-foreground">Uploading…</span> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files;
          if (f?.length) void ingestFiles(f);
          e.target.value = '';
        }}
      />
      {uploadError ? <p className="text-[10px] text-rose-400">{uploadError}</p> : null}

      <div className="scrollbar-themed max-h-[min(16rem,40vh)] overflow-y-auto">
        {galleryImages.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">No images uploaded yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {galleryImages.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-md border border-violet-200/60 bg-white p-1 dark:border-violet-500/20 dark:bg-zinc-900/50"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Add to video"
                      className="rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-900"
                      onClick={() => onAddToCanvas(img)}
                    >
                      <Plus className="mr-0.5 inline h-3 w-3" />
                      Add
                    </button>
                    {onAddAsLogo && canvasW > 0 && canvasH > 0 ? (
                      <button
                        type="button"
                        title="Place as logo (bottom-right)"
                        className="rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white"
                        onClick={() => onAddAsLogo(img)}
                      >
                        Logo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Remove"
                      className="rounded bg-red-600/90 p-1 text-white"
                      onClick={() => {
                        if (!window.confirm('Remove this image?')) return;
                        deleteGalleryImage(img.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="mt-0.5 truncate px-0.5 text-[8px] text-muted-foreground" title={img.name}>
                  {img.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
