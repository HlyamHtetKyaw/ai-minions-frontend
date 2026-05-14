'use client';

import { useEditorStore } from '@/store/editorStore';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function TrimProperties() {
  const duration = useEditorStore((s) => s.duration);
  const trimStart = useEditorStore((s) => s.trimStart);
  const trimEnd = useEditorStore((s) => s.trimEnd);
  const setTrimStart = useEditorStore((s) => s.setTrimStart);
  const setTrimEnd = useEditorStore((s) => s.setTrimEnd);
  const resetTrim = useEditorStore((s) => s.resetTrim);
  const applyTrim = useEditorStore((s) => s.applyTrim);

  const d = duration > 0 ? duration : 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-[11px] leading-relaxed text-muted">
        Drag the amber handles on the video row in the timeline to trim in and out. Only the
        segment between start and end is kept for preview and export.
      </p>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Range (seconds)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-muted">Start</span>
            <input
              type="number"
              min={0}
              max={d > 0 ? d : undefined}
              step={0.1}
              disabled={d <= 0}
              value={Number.isFinite(trimStart) ? trimStart : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                setTrimStart(clamp(v, 0, d));
              }}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-violet-400/40 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:ring-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-muted">End</span>
            <input
              type="number"
              min={0}
              max={d > 0 ? d : undefined}
              step={0.1}
              disabled={d <= 0}
              value={Number.isFinite(trimEnd) ? trimEnd : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                setTrimEnd(clamp(v, 0, d));
              }}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-violet-400/40 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:ring-zinc-600"
            />
          </label>
        </div>
        {d > 0 && (
          <p className="mt-2 text-[10px] tabular-nums text-muted">
            Kept: {(trimEnd - trimStart).toFixed(1)}s of {d.toFixed(1)}s
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={d <= 0}
          onClick={() => resetTrim()}
          className="rounded-lg bg-zinc-200 px-3 py-2 text-left text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-300 disabled:pointer-events-none disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          Reset trim
        </button>
        <button
          type="button"
          disabled={d <= 0}
          onClick={() => applyTrim()}
          className="rounded-lg bg-[#534AB7] px-3 py-2 text-left text-xs font-medium text-white transition-colors hover:bg-[#4539a0] disabled:pointer-events-none disabled:opacity-40"
        >
          Apply trim (export signal)
        </button>
      </div>
    </div>
  );
}
