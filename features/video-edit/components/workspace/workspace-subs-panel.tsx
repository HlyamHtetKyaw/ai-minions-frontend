'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Captions } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { parseSrt } from '@/features/video-edit/lib/parse-srt';

const ACCEPT = '.srt,application/x-subrip,text/plain';

type WorkspaceSubsPanelProps = {
  onImported?: () => void;
};

export function WorkspaceSubsPanel({ onImported }: WorkspaceSubsPanelProps) {
  const t = useTranslations('video-edit.workspace.subs');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importSrtCuesAsTextLayers = useEditorStore((s) => s.importSrtCuesAsTextLayers);

  const applyFile = useCallback(
    (file: File) => {
      setError(null);
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.srt') && file.type !== 'application/x-subrip') {
        setError(t('invalidFile'));
        return;
      }
      void file.text().then((raw) => {
        const cues = parseSrt(raw);
        if (cues.length === 0) {
          setError(t('empty'));
          return;
        }
        importSrtCuesAsTextLayers(cues);
        onImported?.();
      });
    },
    [importSrtCuesAsTextLayers, onImported, t],
  );

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

  return (
    <div className="flex flex-col gap-3 p-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-hidden
        onChange={onInputChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 transition-colors ${
          isDragging
            ? 'border-violet-400/60 bg-violet-500/10'
            : 'border-zinc-600 bg-zinc-950/40 hover:border-zinc-500 hover:bg-zinc-900/50'
        }`}
      >
        <Captions
          className="h-10 w-10 text-zinc-400"
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="text-center text-[11px] font-bold uppercase tracking-wide text-zinc-400">
          {t('uploadTitle')}
        </span>
      </button>
      <p className="text-center text-xs leading-relaxed text-zinc-500">{t('uploadHint')}</p>
      {error != null ? (
        <p className="text-center text-xs text-red-400/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
