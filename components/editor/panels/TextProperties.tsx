'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_CAPTION_BACKGROUND_COLOR,
  resolveCaptionBackgroundColor,
  resolveCaptionBackgroundOpacity,
} from '@/lib/text-layer-caption-style';
import { useEditorStore } from '@/store/editorStore';

const SWATCHES = ['#ffffff', '#000000', '#7F77DD', '#5DCAA5', '#EF9F27'] as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function TextProperties() {
  const tPanel = useTranslations('video-edit.workspace.textPanel');
  const duration = useEditorStore((s) => s.duration);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const textLayers = useEditorStore((s) => s.textLayers);
  const addTextLayer = useEditorStore((s) => s.addTextLayer);
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const deleteTextLayer = useEditorStore((s) => s.deleteTextLayer);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  const layer =
    selectedLayerId == null
      ? undefined
      : textLayers.find((l) => l.id === selectedLayerId && l.type === 'text');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(80, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    syncTextareaHeight();
  }, [layer?.content, syncTextareaHeight]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <button
        type="button"
        onClick={() => addTextLayer()}
        className="rounded-lg bg-zinc-200 px-3 py-2 text-left text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        + Add text
      </button>

      {layer != null && (
        <>
          {layer.srtImportBatchId != null && layer.srtImportBatchId !== '' ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] leading-relaxed text-muted dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-400">
              {tPanel('srtStyleSyncHint')}
            </p>
          ) : null}
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Content
            </h3>
            <textarea
              ref={textareaRef}
              value={layer.content}
              rows={3}
              onChange={(e) => {
                updateTextLayer(layer.id, { content: e.target.value });
                queueMicrotask(syncTextareaHeight);
              }}
              className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-foreground outline-none ring-zinc-300 focus:ring-1 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:ring-zinc-600"
              style={{
                fontFamily: `"Pyidaungsu", "Noto Sans Myanmar", "Myanmar Text", sans-serif`,
                whiteSpace: 'pre-wrap',
              }}
            />
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Font
            </h3>
            <div className="flex flex-col gap-2">
              <div className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100">
                Pyidaungsu (default)
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-16 shrink-0">Size</span>
                <input
                  type="number"
                  min={8}
                  max={200}
                  value={layer.fontSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updateTextLayer(layer.id, {
                      fontSize: clamp(Math.round(v), 8, 200),
                    });
                  }}
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-foreground tabular-nums outline-none focus:ring-1 focus:ring-violet-400/40 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:ring-zinc-600"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Color
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => updateTextLayer(layer.id, { color: c })}
                  className="h-7 w-7 shrink-0 rounded border border-zinc-300 ring-offset-2 ring-offset-white focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:ring-offset-zinc-950"
                  style={{
                    backgroundColor: c,
                    boxShadow:
                      layer.color.toLowerCase() === c.toLowerCase()
                        ? '0 0 0 2px #5DCAA5'
                        : undefined,
                  }}
                />
              ))}
              <label className="ml-1 flex items-center gap-2 text-xs text-muted">
                <span>Custom</span>
                <input
                  type="color"
                  value={
                    /^#[0-9A-Fa-f]{6}$/.test(layer.color) ? layer.color : '#ffffff'
                  }
                  onChange={(e) =>
                    updateTextLayer(layer.id, { color: e.target.value })
                  }
                  className="h-8 w-12 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-600"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {tPanel('textOpacity')}
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={layer.opacity}
                onChange={(e) =>
                  updateTextLayer(layer.id, {
                    opacity: clamp(Number(e.target.value), 0, 100),
                  })
                }
                className="min-w-0 flex-1 accent-[#5DCAA5]"
              />
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-foreground">
                {layer.opacity}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {tPanel('captionBackground')}
            </h3>
            <p className="mb-2 text-[10px] leading-relaxed text-muted">
              {tPanel('captionBackgroundHint')}
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-16 shrink-0">{tPanel('backgroundColor')}</span>
                <input
                  type="color"
                  value={
                    /^#[0-9A-Fa-f]{6}$/.test(resolveCaptionBackgroundColor(layer))
                      ? resolveCaptionBackgroundColor(layer)
                      : DEFAULT_CAPTION_BACKGROUND_COLOR
                  }
                  onChange={(e) =>
                    updateTextLayer(layer.id, { backgroundColor: e.target.value })
                  }
                  className="h-8 w-12 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-600"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-16 shrink-0">{tPanel('backgroundOpacity')}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={resolveCaptionBackgroundOpacity(layer)}
                  onChange={(e) =>
                    updateTextLayer(layer.id, {
                      backgroundOpacity: clamp(Number(e.target.value), 0, 100),
                    })
                  }
                  className="min-w-0 flex-1 accent-[#5DCAA5]"
                  aria-label={tPanel('backgroundOpacity')}
                />
                <span className="w-8 shrink-0 text-right tabular-nums text-foreground">
                  {resolveCaptionBackgroundOpacity(layer)}
                </span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Timing
            </h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-20 shrink-0">Start (s)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={layer.startTime}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const startTime = Math.max(0, v);
                    const endTime = Math.max(startTime, layer.endTime);
                    updateTextLayer(layer.id, { startTime, endTime });
                  }}
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-foreground tabular-nums outline-none focus:ring-1 focus:ring-violet-400/40 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:ring-zinc-600"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-20 shrink-0">End (s)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={layer.endTime}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const maxEnd = Math.max(0, duration);
                    const endTime = clamp(v, layer.startTime, maxEnd);
                    updateTextLayer(layer.id, { endTime });
                  }}
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-foreground tabular-nums outline-none focus:ring-1 focus:ring-violet-400/40 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:ring-zinc-600"
                />
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              deleteTextLayer(layer.id);
              setSelectedLayerId(null);
            }}
            className="mt-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-[#3f1515] dark:text-rose-300"
          >
            Delete text layer
          </button>
        </>
      )}
    </div>
  );
}
