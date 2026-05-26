'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  encodeGalleryImageDragPayload,
  GALLERY_IMAGE_DRAG_MIME,
} from '@/lib/galleryImageDrag';
import { fetchDeveloperGalleryImages } from '@/lib/developer-image-gallery-api';
import { ingestWorkspaceGalleryFiles } from '@/lib/ingest-workspace-gallery-image';
import { useEditorStore } from '@/store/editorStore';
import type { GalleryImage } from '@/store/editorStore';

const ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,.png,.jpg,.jpeg,.webp,.svg,.gif';

function isDeveloperCatalogImage(id: string): boolean {
  return id.startsWith('db-');
}

function UploadIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-muted"
      aria-hidden
    >
      <path d="M12 16V4m0 0l4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 14.5V18a2 2 0 002 2h12a2 2 0 002-2v-3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ImageGalleryPanelProps = {
  /** When true, also loads curated developer catalog images (user uploads still allowed). */
  developerSourceOnly?: boolean;
};

export function ImageGalleryPanel({ developerSourceOnly = false }: ImageGalleryPanelProps) {
  const galleryImages = useEditorStore((s) => s.galleryImages);
  const addGalleryImage = useEditorStore((s) => s.addGalleryImage);
  const setGalleryImageRemoteSrc = useEditorStore((s) => s.setGalleryImageRemoteSrc);
  const deleteGalleryImage = useEditorStore((s) => s.deleteGalleryImage);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!developerSourceOnly) return;
    let cancelled = false;
    setBusy(true);
    setLoadError(null);
    void fetchDeveloperGalleryImages()
      .then((catalog) => {
        if (cancelled) return;
        useEditorStore.setState((state) => {
          const userUploads = state.galleryImages.filter((g) => !isDeveloperCatalogImage(g.id));
          const catalogIds = new Set(catalog.map((g) => g.id));
          const dedupedUser = userUploads.filter((g) => !catalogIds.has(g.id));
          return {
            ...state,
            galleryImages: [...catalog, ...dedupedUser],
          };
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load gallery images');
      })
      .finally(() => {
        if (cancelled) return;
        setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [developerSourceOnly]);

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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void ingestFiles(e.dataTransfer.files);
    },
    [ingestFiles],
  );

  const onAddToCanvas = useCallback(
    (img: GalleryImage) => {
      addImageLayer(img);
    },
    [addImageLayer],
  );

  const onDeleteGallery = useCallback(
    (id: string) => {
      if (isDeveloperCatalogImage(id)) return;
      if (!window.confirm('Remove this image from gallery?')) return;
      deleteGalleryImage(id);
    },
    [deleteGalleryImage],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {developerSourceOnly ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-muted dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-400">
          Curated gallery images plus your own uploads below.
        </p>
      ) : null}

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
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/90 px-3 py-6 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/40 dark:hover:border-zinc-500 dark:hover:bg-zinc-900/70"
      >
        <UploadIcon />
        <span className="text-xs font-medium text-foreground">Drop images here or click to upload</span>
        <span className="text-[10px] text-muted">PNG · JPG · WebP · SVG · GIF</span>
        {busy ? <span className="text-[10px] text-muted">Working…</span> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files;
          if (f?.length) void ingestFiles(f);
          e.target.value = '';
        }}
      />

      {uploadError ? <p className="text-center text-xs text-rose-400">{uploadError}</p> : null}

      <div className="@container w-full min-w-0 shrink-0">
        <div
          className="scrollbar-themed max-h-[min(27rem,calc(3*((100cqw-0.5rem)/2+1.125rem)+1.25rem))] w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]"
          role="region"
          aria-label="Gallery images"
        >
          {loadError ? (
            <p className="py-2 text-center text-xs text-rose-400">{loadError}</p>
          ) : busy && galleryImages.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted">Loading images…</p>
          ) : galleryImages.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted">No images yet — upload from your device</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 pb-1">
              {galleryImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-700/80 dark:bg-zinc-900/60"
                >
                  <div
                    className="relative aspect-square w-full cursor-grab overflow-hidden rounded bg-black/40 active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(GALLERY_IMAGE_DRAG_MIME, img.id);
                      e.dataTransfer.setData('text/plain', encodeGalleryImageDragPayload(img.id));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt=""
                      draggable={false}
                      className="pointer-events-none h-full w-full select-none object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Add to canvas"
                        draggable={false}
                        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 ring-1 ring-zinc-300 hover:bg-[#534AB7] hover:text-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCanvas(img);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {!isDeveloperCatalogImage(img.id) ? (
                        <button
                          type="button"
                          title="Remove from gallery"
                          draggable={false}
                          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 ring-1 ring-zinc-300 hover:bg-red-600 hover:text-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600 dark:hover:bg-red-900/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGallery(img.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 truncate px-0.5 text-[9px] text-muted" title={img.name}>
                    {img.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
