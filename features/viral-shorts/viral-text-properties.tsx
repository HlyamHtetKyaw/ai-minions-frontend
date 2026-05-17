'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_CAPTION_BACKGROUND_COLOR,
  resolveCaptionBackgroundColor,
  resolveCaptionBackgroundOpacity,
} from '@/lib/text-layer-caption-style';
import type { TextLayer } from '@/store/editorStore';

const SWATCHES = ['#ffffff', '#000000', '#7F77DD', '#5DCAA5', '#EF9F27'] as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type Props = {
  layer: TextLayer;
  durationSec: number;
  onUpdate: (id: string, patch: Partial<TextLayer>) => void;
  onDelete: () => void;
};

/** Caption styling aligned with video editor `TextProperties`. */
export function ViralTextProperties({ layer, durationSec, onUpdate, onDelete }: Props) {
  const tPanel = useTranslations('video-edit.workspace.textPanel');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(64, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    syncTextareaHeight();
  }, [layer.content, syncTextareaHeight]);

  return (
    <div className="space-y-3">
      {layer.srtImportBatchId ? (
        <p className="rounded-md border border-violet-200/60 bg-violet-50/80 px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground dark:border-violet-400/15 dark:bg-violet-500/10">
          {tPanel('srtStyleSyncHint')}
        </p>
      ) : null}

      <label className="block text-[10px] text-muted-foreground">
        Content
        <textarea
          ref={textareaRef}
          value={layer.content}
          rows={2}
          onChange={(e) => {
            onUpdate(layer.id, { content: e.target.value });
            queueMicrotask(syncTextareaHeight);
          }}
          className="mt-0.5 w-full resize-none rounded border border-violet-500/25 bg-white px-2 py-1 text-[12px] text-foreground outline-none dark:border-violet-400/20 dark:bg-zinc-900/40"
          style={{
            fontFamily: `"Pyidaungsu", "Noto Sans Myanmar", "Myanmar Text", sans-serif`,
            whiteSpace: 'pre-wrap',
          }}
        />
      </label>

      <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="w-12 shrink-0">Size</span>
        <input
          type="number"
          min={8}
          max={200}
          value={layer.fontSize}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onUpdate(layer.id, { fontSize: clamp(Math.round(v), 8, 200) });
          }}
          className="min-w-0 flex-1 rounded border border-violet-500/25 bg-white px-2 py-0.5 text-[11px] dark:border-violet-400/20 dark:bg-zinc-900/40"
        />
      </label>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Color</p>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => onUpdate(layer.id, { color: c })}
              className="h-6 w-6 shrink-0 rounded border border-violet-200/60 dark:border-violet-400/25"
              style={{
                backgroundColor: c,
                boxShadow: layer.color.toLowerCase() === c.toLowerCase() ? '0 0 0 2px #7c5cff' : undefined,
              }}
            />
          ))}
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(layer.color) ? layer.color : '#ffffff'}
            onChange={(e) => onUpdate(layer.id, { color: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-violet-200/50 bg-transparent p-0"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="w-16 shrink-0">{tPanel('textOpacity')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={layer.opacity}
          onChange={(e) =>
            onUpdate(layer.id, { opacity: clamp(Number(e.target.value), 0, 100) })
          }
          className="min-w-0 flex-1 accent-[#7c5cff]"
        />
        <span className="w-6 tabular-nums text-foreground">{layer.opacity}</span>
      </label>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {tPanel('captionBackground')}
        </p>
        <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{tPanel('captionBackgroundHint')}</p>
        <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12 shrink-0">{tPanel('backgroundColor')}</span>
          <input
            type="color"
            value={
              /^#[0-9A-Fa-f]{6}$/.test(resolveCaptionBackgroundColor(layer))
                ? resolveCaptionBackgroundColor(layer)
                : DEFAULT_CAPTION_BACKGROUND_COLOR
            }
            onChange={(e) => onUpdate(layer.id, { backgroundColor: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-violet-200/50 bg-transparent p-0"
          />
        </label>
        <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12 shrink-0">{tPanel('backgroundOpacity')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={resolveCaptionBackgroundOpacity(layer)}
            onChange={(e) =>
              onUpdate(layer.id, {
                backgroundOpacity: clamp(Number(e.target.value), 0, 100),
              })
            }
            className="min-w-0 flex-1 accent-[#7c5cff]"
          />
          <span className="w-6 tabular-nums text-foreground">
            {resolveCaptionBackgroundOpacity(layer)}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12 shrink-0">Start</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={layer.startTime}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const startTime = Math.max(0, v);
              onUpdate(layer.id, { startTime, endTime: Math.max(startTime, layer.endTime) });
            }}
            className="min-w-0 flex-1 rounded border border-violet-500/25 bg-white px-2 py-0.5 text-[11px] tabular-nums dark:border-violet-400/20 dark:bg-zinc-900/40"
          />
        </label>
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12 shrink-0">End</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={layer.endTime}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const maxEnd = Math.max(0, durationSec);
              onUpdate(layer.id, { endTime: clamp(v, layer.startTime, maxEnd) });
            }}
            className="min-w-0 flex-1 rounded border border-violet-500/25 bg-white px-2 py-0.5 text-[11px] tabular-nums dark:border-violet-400/20 dark:bg-zinc-900/40"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="w-full rounded-md border border-red-500/35 px-2 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-300"
      >
        Delete layer
      </button>
    </div>
  );
}
