'use client';

import { FlipHorizontal, FlipVertical } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

type CropPropertiesProps = {
  /** e.g. workspace local rail: switch back to media after apply */
  onAfterApply?: () => void;
};

export function CropProperties(props: CropPropertiesProps = {}) {
  const { onAfterApply } = props;
  const cropSettings = useEditorStore((s) => s.cropSettings);
  const setCropSettings = useEditorStore((s) => s.setCropSettings);
  const resetCrop = useEditorStore((s) => s.resetCrop);
  const applyCrop = useEditorStore((s) => s.applyCrop);
  const fw = useEditorStore((s) => s.canvasFrameWidth);
  const fh = useEditorStore((s) => s.canvasFrameHeight);

  const {
    top,
    bottom,
    left,
    right,
    easyZoom,
    easyRotation,
    easyAspect,
    flipHorizontal,
    flipVertical,
    croppedAreaPixels,
  } = cropSettings;

  const resultW = Math.max(0, Math.round(fw - left - right));
  const resultH = Math.max(0, Math.round(fh - top - bottom));

  const originalAspect = fw > 0 && fh > 0 ? fw / fh : 16 / 9;

  return (
    <div className="flex flex-col gap-4 p-3">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Zoom & rotation
        </h3>
        <label className="mb-3 flex flex-col gap-1 text-xs text-zinc-400">
          <span className="flex justify-between tabular-nums">
            Zoom <span>{easyZoom.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={easyZoom}
            onChange={(e) =>
              setCropSettings({ easyZoom: Number(e.target.value) })
            }
            className="accent-[#534AB7]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span className="flex justify-between tabular-nums">
            Rotation <span>{Math.round(easyRotation)}°</span>
          </span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={easyRotation}
            onChange={(e) =>
              setCropSettings({ easyRotation: Number(e.target.value) })
            }
            className="accent-[#534AB7]"
          />
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Flip
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={flipHorizontal}
            onClick={() =>
              setCropSettings({ flipHorizontal: !flipHorizontal })
            }
            className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              flipHorizontal
                ? 'border-[#534AB7] bg-[#534AB7]/20 text-zinc-100'
                : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <FlipHorizontal className="size-4 shrink-0" strokeWidth={1.75} />
            Horizontal
          </button>
          <button
            type="button"
            aria-pressed={flipVertical}
            onClick={() => setCropSettings({ flipVertical: !flipVertical })}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              flipVertical
                ? 'border-[#534AB7] bg-[#534AB7]/20 text-zinc-100'
                : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <FlipVertical className="size-4 shrink-0" strokeWidth={1.75} />
            Vertical
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Aspect ratio
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCropSettings({ easyAspect: originalAspect })}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => setCropSettings({ easyAspect: 16 / 9 })}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            16:9
          </button>
          <button
            type="button"
            onClick={() => setCropSettings({ easyAspect: 9 / 16 })}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            9:16
          </button>
          <button
            type="button"
            onClick={() => setCropSettings({ easyAspect: 1 })}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            1:1
          </button>
          <button
            type="button"
            onClick={() => setCropSettings({ easyAspect: 4 / 3 })}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            4:3
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Current ratio ≈ {(easyAspect > 0 ? easyAspect : originalAspect).toFixed(3)} : 1
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Output
        </h3>
        <p className="text-xs text-zinc-400">
          Frame hint: {resultW} × {resultH}px
          {croppedAreaPixels
            ? ` · crop rect ${croppedAreaPixels.width}×${croppedAreaPixels.height}px (source space)`
            : null}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">
          With rotation or flip, edge values stay zero; export uses crop area, angle, and
          flip flags together.
        </p>
      </section>

      <button
        type="button"
        onClick={() => resetCrop()}
        className="rounded-lg border border-zinc-600 bg-transparent px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
      >
        Reset
      </button>

      <button
        type="button"
        onClick={() => {
          applyCrop();
          onAfterApply?.();
        }}
        className="rounded-lg bg-[#534AB7] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#4539a0]"
      >
        Apply crop
      </button>
    </div>
  );
}
