'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { isAllowedVideoFile, VIDEO_FILE_ACCEPT_ATTR } from '@/components/editor/video-file';
import { applyLocalVideoFileWithWorkspaceUpload } from '@/lib/workspace-video-source';

type UploadAspectId = '16:9' | '9:16' | '1:1' | '4:3';

function aspectIdToRatio(aspect: UploadAspectId): number {
  if (aspect === '16:9') return 16 / 9;
  if (aspect === '9:16') return 9 / 16;
  if (aspect === '1:1') return 1;
  return 4 / 3;
}

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
  /** Skip orientation modal and upload immediately using `defaultAspect`. */
  requireAspectChoice?: boolean;
  /** Aspect used when `requireAspectChoice` is false. */
  defaultAspect?: UploadAspectId;
};

export function MediaUpload({
  variant = 'default',
  fileInputId,
  requireAspectChoice = true,
  defaultAspect = '16:9',
}: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setVideoSrc = useEditorStore((s) => s.setVideoSrc);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedAspect, setSelectedAspect] = useState<UploadAspectId>(defaultAspect);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current != null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const applyFile = useCallback(
    async (file: File, aspect: UploadAspectId) => {
      if (!isAllowedVideoFile(file)) return;

      clearProgressTimer();
      setProgress(0);
      setUploadError(null);
      setPendingFile(null);
      setFileName(file.name);
      setFileSize(file.size);

      progressTimerRef.current = setInterval(() => {
        setProgress((p) => {
          const next = Math.min(92, p + 6);
          if (next >= 100 && progressTimerRef.current != null) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          return next;
        });
      }, 45);

      try {
        await applyLocalVideoFileWithWorkspaceUpload(file, setVideoSrc, aspectIdToRatio(aspect));
        setProgress(100);
      } catch (error) {
        console.warn('[video-editor] file upload failed', error);
        setUploadError(
          error instanceof Error ? error.message : 'Upload failed; export needs a cloud URL. Try again.',
        );
      } finally {
        clearProgressTimer();
      }
    },
    [clearProgressTimer, setVideoSrc],
  );

  useEffect(() => {
    return () => {
      clearProgressTimer();
    };
  }, [clearProgressTimer]);

  useEffect(() => {
    setSelectedAspect(defaultAspect);
  }, [defaultAspect]);

  const queueFileForUpload = (file: File) => {
    if (!isAllowedVideoFile(file)) return;
    setUploadError(null);
    if (!requireAspectChoice) {
      void applyFile(file, selectedAspect);
      return;
    }
    setPendingFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) queueFileForUpload(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) queueFileForUpload(file);
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
          ? 'flex h-full min-h-0 w-full min-w-0 max-w-full flex-col justify-center gap-3'
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
          isCentered
            ? 'min-h-0 flex-1 basis-0 px-4 py-8 sm:px-6 sm:py-10'
            : 'min-h-[140px] px-4 py-8',
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
        <div className="max-w-full px-1 text-center">
          <p className="text-sm font-medium text-zinc-200">
            Drop a video here or click to browse
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            MP4, MOV, or WebM. The file uploads so export can run on the server.
          </p>
          {uploadError ? (
            <p className="mt-2 max-w-md text-xs text-rose-400" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      </button>

      {requireAspectChoice && pendingFile != null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose video orientation"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Choose orientation before upload
            </p>
            <p className="mt-1 truncate text-xs text-zinc-500" title={pendingFile.name}>
              {pendingFile.name}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedAspect('16:9')}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selectedAspect === '16:9' || selectedAspect === '4:3'
                    ? 'border-violet-400/60 bg-violet-500/20 text-foreground'
                    : 'border-white/15 bg-transparent text-zinc-300 hover:border-white/30'
                }`}
              >
                Landscape
              </button>
              <button
                type="button"
                onClick={() => setSelectedAspect('9:16')}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selectedAspect === '9:16'
                    ? 'border-violet-400/60 bg-violet-500/20 text-foreground'
                    : 'border-white/15 bg-transparent text-zinc-300 hover:border-white/30'
                }`}
              >
                Portrait
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {(['16:9', '9:16', '1:1', '4:3'] as const).map((aspect) => (
                <button
                  key={aspect}
                  type="button"
                  onClick={() => setSelectedAspect(aspect)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    selectedAspect === aspect
                      ? 'border-violet-400/60 bg-violet-500/20 text-foreground'
                      : 'border-white/15 bg-transparent text-zinc-300 hover:border-white/30'
                  }`}
                >
                  {aspect}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void applyFile(pendingFile, selectedAspect)}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-violet-400/40 hover:bg-violet-500/10"
              >
                Continue upload
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fileName != null && fileSize != null && (
        <div className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-3 py-2">
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
