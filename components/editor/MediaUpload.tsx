'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import {
  applyVideoFileToEditor,
  VIDEO_FILE_ACCEPT_ATTR,
} from '@/components/editor/video-file';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type MediaUploadProps = {
  /** Larger padding and min height for the centered canvas dropzone. */
  variant?: 'default' | 'centered';
  /** When set, the hidden file input is addressable for programmatic `.click()` (e.g. media tool). */
  fileInputId?: string;
};

export function MediaUpload({ variant = 'default', fileInputId }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setVideoSrc = useEditorStore((s) => s.setVideoSrc);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current != null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const applyFile = useCallback(
    (file: File) => {
      if (!applyVideoFileToEditor(file, setVideoSrc)) return;

      clearProgressTimer();
      setProgress(0);
      setFileName(file.name);
      setFileSize(file.size);

      progressTimerRef.current = setInterval(() => {
        setProgress((p) => {
          const next = Math.min(100, p + 6);
          if (next >= 100 && progressTimerRef.current != null) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          return next;
        });
      }, 45);
    },
    [clearProgressTimer, setVideoSrc],
  );

  useEffect(() => {
    return () => {
      clearProgressTimer();
    };
  }, [clearProgressTimer]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const isCentered = variant === 'centered';

  return (
    <div
      className={
        isCentered
          ? 'flex w-full max-w-xl flex-col gap-4'
          : 'flex w-full flex-col gap-3'
      }
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'group relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
          isCentered ? 'min-h-[220px] px-8 py-12' : 'min-h-[140px] px-4 py-8',
          isDragging
            ? 'border-sky-500/80 bg-sky-500/10'
            : 'border-zinc-600 bg-zinc-900/80 hover:border-zinc-500 hover:bg-zinc-800/60',
        ].join(' ')}
      >
        <input
          id={fileInputId}
          ref={inputRef}
          type="file"
          accept={VIDEO_FILE_ACCEPT_ATTR}
          className="sr-only"
          onChange={onInputChange}
        />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-200">
            Drop a video here or click to browse
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            MP4, MOV, or WebM — local preview only (no upload yet)
          </p>
        </div>
      </button>

      {fileName != null && fileSize != null && (
        <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
            <span className="truncate font-medium text-zinc-300" title={fileName}>
              {fileName}
            </span>
            <span className="shrink-0 tabular-nums">{formatBytes(fileSize)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
            {progress < 100 ? `Preparing… ${progress}%` : 'Ready'}
          </p>
        </div>
      )}
    </div>
  );
}
