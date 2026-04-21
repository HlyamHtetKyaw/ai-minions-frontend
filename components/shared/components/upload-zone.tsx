'use client';

import { useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';

type Props = {
  accept?: string;
  onFileChange?: (file: File | null) => void;
  label?: string;
  /** Small caps / section label above the drop zone */
  kicker?: string;
  /** Overrides default first instruction line */
  instructionPrimary?: string;
  /** Second line (e.g. formats). Omit for default 'or drag and drop'; pass "" to hide */
  instructionSecondary?: string;
  className?: string;
  dropzoneClassName?: string;
  /** Applied while dragging when using a custom `dropzoneClassName` (defaults to transcribe active style) */
  dropzoneActiveClassName?: string;
};

export default function UploadZone({
  accept,
  onFileChange,
  label,
  kicker,
  instructionPrimary,
  instructionSecondary,
  className,
  dropzoneClassName,
  dropzoneActiveClassName = 'transcribe-dropzone-active',
}: Props) {
  const t = useTranslations('shared.uploadZone');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVideo = file?.type.startsWith('video/');
  const isAudio = file?.type.startsWith('audio/');
  const objectUrl = file ? URL.createObjectURL(file) : null;

  const handleFile = useCallback(
    (f: File | null) => {
      setFile(f);
      onFileChange?.(f);
    },
    [onFileChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleRemove = () => {
    handleFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const line1 = instructionPrimary ?? t('clickToUpload');
  const useDefaultSecondLine =
    instructionPrimary === undefined && instructionSecondary === undefined;
  const line2 = useDefaultSecondLine
    ? t('dragDrop')
    : instructionSecondary !== undefined
      ? instructionSecondary
      : undefined;
  const showLine2 = useDefaultSecondLine || (line2 !== undefined && line2 !== '');

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {kicker && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {kicker}
        </p>
      )}
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}

      {!file && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={
            dropzoneClassName
              ? `flex cursor-pointer flex-col items-center justify-center gap-3 p-10 transition-colors ${dropzoneClassName} ${isDragging ? dropzoneActiveClassName : ''}`
              : `flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
                  isDragging
                    ? 'border-foreground bg-subtle'
                    : 'border-card-border hover:border-foreground hover:bg-subtle'
                }`
          }
        >
          <Upload className="h-8 w-8 text-muted" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">{line1}</p>
            {showLine2 && line2 !== undefined && (
              <p className="text-xs text-muted leading-relaxed">{line2}</p>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />

      {file && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {file.name}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              aria-label={t('remove')}
              className="shrink-0 rounded p-0.5 text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isVideo && objectUrl && (
            <video src={objectUrl} controls className="w-full rounded-xl" />
          )}
          {isAudio && objectUrl && (
            <audio src={objectUrl} controls className="w-full" />
          )}
        </div>
      )}
    </div>
  );
}
