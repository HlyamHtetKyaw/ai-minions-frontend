'use client';

import { useEditorStore } from '@/store/editorStore';

const PRESETS = [0.25, 0.5, 1, 1.5, 2, 4] as const;

export function SpeedProperties() {
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useEditorStore((s) => s.setPlaybackSpeed);

  return (
    <div className="flex flex-col gap-4 p-3">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Speed
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="min-w-0 flex-1 accent-[#534AB7]"
          />
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-300">
            {playbackSpeed}x
          </span>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Quick presets
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlaybackSpeed(p)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors ${
                Math.abs(playbackSpeed - p) < 1e-6
                  ? 'bg-[#534AB7] text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {p}x
            </button>
          ))}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Audio pitch correction applied on export
      </p>
    </div>
  );
}
