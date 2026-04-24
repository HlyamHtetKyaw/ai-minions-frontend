'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

const FONT_OPTIONS = [
  'Inter',
  'Noto Sans Myanmar',
  'Montserrat',
  'Playfair Display',
  'Roboto Mono',
  'Oswald',
] as const;

const SWATCHES = ['#ffffff', '#000000', '#7F77DD', '#5DCAA5', '#EF9F27'] as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function TextProperties() {
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
        className="rounded-lg bg-zinc-800 px-3 py-2 text-left text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
      >
        + Add text
      </button>

      {layer != null && (
        <>
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
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
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 text-sm text-zinc-100 outline-none ring-zinc-600 focus:ring-1"
              style={{
                fontFamily: `"${layer.fontFamily}", "Noto Sans Myanmar", "Pyidaungsu", "Myanmar Text", sans-serif`,
              }}
            />
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Font
            </h3>
            <div className="flex flex-col gap-2">
              <select
                value={layer.fontFamily}
                onChange={(e) =>
                  updateTextLayer(layer.id, { fontFamily: e.target.value })
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-600"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
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
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Color
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => updateTextLayer(layer.id, { color: c })}
                  className="h-7 w-7 shrink-0 rounded border border-zinc-600 ring-offset-2 ring-offset-[#121212] focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  style={{
                    backgroundColor: c,
                    boxShadow:
                      layer.color.toLowerCase() === c.toLowerCase()
                        ? '0 0 0 2px #5DCAA5'
                        : undefined,
                  }}
                />
              ))}
              <label className="ml-1 flex items-center gap-2 text-xs text-zinc-400">
                <span>Custom</span>
                <input
                  type="color"
                  value={
                    /^#[0-9A-Fa-f]{6}$/.test(layer.color) ? layer.color : '#ffffff'
                  }
                  onChange={(e) =>
                    updateTextLayer(layer.id, { color: e.target.value })
                  }
                  className="h-8 w-12 cursor-pointer rounded border border-zinc-600 bg-transparent p-0"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Opacity
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
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-300">
                {layer.opacity}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Timing
            </h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
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
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
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
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
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
            className="mt-2 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: '#3f1515', color: '#f87171' }}
          >
            Delete text layer
          </button>
        </>
      )}
    </div>
  );
}
