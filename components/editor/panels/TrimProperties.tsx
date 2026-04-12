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
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Drag the amber handles on the video row in the timeline to trim in and out. Only the
        segment between start and end is kept for preview and export.
      </p>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Range (seconds)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500">Start</span>
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
              className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-100 outline-none disabled:opacity-40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500">End</span>
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
              className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-100 outline-none disabled:opacity-40"
            />
          </label>
        </div>
        {d > 0 && (
          <p className="mt-2 text-[10px] tabular-nums text-zinc-500">
            Kept: {(trimEnd - trimStart).toFixed(1)}s of {d.toFixed(1)}s
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={d <= 0}
          onClick={() => resetTrim()}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-left text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:pointer-events-none disabled:opacity-40"
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
