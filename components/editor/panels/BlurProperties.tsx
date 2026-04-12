'use client';

import { useEditorStore } from '@/store/editorStore';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function BlurProperties() {
  const duration = useEditorStore((s) => s.duration);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const blurLayers = useEditorStore((s) => s.blurLayers);
  const addBlurLayer = useEditorStore((s) => s.addBlurLayer);
  const updateBlurLayer = useEditorStore((s) => s.updateBlurLayer);
  const deleteBlurLayer = useEditorStore((s) => s.deleteBlurLayer);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  const layer =
    selectedLayerId == null
      ? undefined
      : blurLayers.find((l) => l.id === selectedLayerId && l.type === 'blur');

  return (
    <div className="flex flex-col gap-4 p-3">
      <button
        type="button"
        onClick={() => addBlurLayer()}
        className="rounded-lg bg-zinc-800 px-3 py-2 text-left text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
      >
        + Add blur region
      </button>

      {layer != null && (
        <>
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Intensity
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={layer.intensity}
                onChange={(e) =>
                  updateBlurLayer(layer.id, {
                    intensity: clamp(Number(e.target.value), 0, 100),
                  })
                }
                className="min-w-0 flex-1 accent-[#5DCAA5]"
              />
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-300">
                {layer.intensity}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Position and size
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                <span>X</span>
                <input
                  type="number"
                  value={Math.round(layer.x)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updateBlurLayer(layer.id, { x: v });
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                <span>Y</span>
                <input
                  type="number"
                  value={Math.round(layer.y)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updateBlurLayer(layer.id, { y: v });
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                <span>W</span>
                <input
                  type="number"
                  min={1}
                  value={Math.round(layer.width)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updateBlurLayer(layer.id, { width: Math.max(1, Math.round(v)) });
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                <span>H</span>
                <input
                  type="number"
                  min={1}
                  value={Math.round(layer.height)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updateBlurLayer(layer.id, { height: Math.max(1, Math.round(v)) });
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
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
                  updateBlurLayer(layer.id, {
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
                    updateBlurLayer(layer.id, { startTime, endTime });
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
                    updateBlurLayer(layer.id, { endTime });
                  }}
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              deleteBlurLayer(layer.id);
              setSelectedLayerId(null);
            }}
            className="mt-2 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: '#3f1515', color: '#f87171' }}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
