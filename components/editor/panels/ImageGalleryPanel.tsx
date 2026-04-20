'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  encodeGalleryImageDragPayload,
  GALLERY_IMAGE_DRAG_MIME,
} from '@/lib/galleryImageDrag';
import { useEditorStore } from '@/store/editorStore';
import type { GalleryImage } from '@/store/editorStore';
import { uploadVideoEditorFile } from '@/lib/video-editor-workspace-api';
import { fetchDeveloperGalleryImages } from '@/lib/developer-image-gallery-api';

const ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,.png,.jpg,.jpeg,.webp,.svg,.gif';

function UploadIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-zinc-500"
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
  developerSourceOnly?: boolean;
};

export function ImageGalleryPanel({ developerSourceOnly = false }: ImageGalleryPanelProps) {
  const galleryImages = useEditorStore((s) => s.galleryImages);
  const addGalleryImage = useEditorStore((s) => s.addGalleryImage);
  const deleteGalleryImage = useEditorStore((s) => s.deleteGalleryImage);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!developerSourceOnly) return;
    let cancelled = false;
    setBusy(true);
    setLoadError(null);
    void fetchDeveloperGalleryImages()
      .then((images) => {
        if (cancelled) return;
        useEditorStore.setState((state) => ({
          ...state,
          galleryImages: images,
        }));
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

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setBusy(true);
      try {
        for (const file of list) {
          try {
            await addGalleryImage(file);
            await uploadVideoEditorFile(file);
          } catch {
            // Skip invalid images; optional: toast
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [addGalleryImage],
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
      if (!window.confirm('Remove this image from gallery?')) return;
      deleteGalleryImage(id);
    },
    [deleteGalleryImage],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {developerSourceOnly ? (
        <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
          Images are loaded from developer gallery.
        </div>
      ) : (
        <>
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
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-600 bg-zinc-900/40 px-3 py-6 text-center transition-colors hover:border-zinc-500 hover:bg-zinc-900/70"
          >
            <UploadIcon />
            <span className="text-xs font-medium text-zinc-300">Drop images here</span>
            <span className="text-[10px] text-zinc-500">PNG · JPG · WebP · SVG</span>
            {busy && <span className="text-[10px] text-zinc-500">Uploading…</span>}
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
        </>
      )}

      {/* cqw = this width; row ≈ col + p-1 + square(col−0.5rem) + mt-1 + 9px line + pb; +2×gap-2 + grid pb-1 */}
      <div className="@container w-full min-w-0 shrink-0">
        <div
          className="max-h-[min(27rem,calc(3*((100cqw-0.5rem)/2+1.125rem)+1.25rem))] w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]"
          role="region"
          aria-label="Uploaded images"
        >
        {loadError ? (
          <p className="py-2 text-center text-xs text-rose-400">{loadError}</p>
        ) : busy && galleryImages.length === 0 ? (
          <p className="py-2 text-center text-xs text-zinc-500">Loading images...</p>
        ) : galleryImages.length === 0 ? (
          <p className="py-2 text-center text-xs text-zinc-500">No images yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 pb-1">
            {galleryImages.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-md border border-zinc-700/80 bg-zinc-900/60 p-1"
              >
                <div
                  className="relative aspect-square w-full cursor-grab overflow-hidden rounded bg-black/40 active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(GALLERY_IMAGE_DRAG_MIME, img.id);
                    e.dataTransfer.setData(
                      'text/plain',
                      encodeGalleryImageDragPayload(img.id),
                    );
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
                      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 hover:bg-[#534AB7]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCanvas(img);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    {!developerSourceOnly ? (
                      <button
                        type="button"
                        title="Remove from gallery"
                        draggable={false}
                        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 hover:bg-red-900/80"
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
                <p className="mt-1 truncate px-0.5 text-[9px] text-zinc-500" title={img.name}>
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
