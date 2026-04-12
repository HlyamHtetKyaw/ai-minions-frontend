'use client';

import { useCallback, useMemo } from 'react';
import { Link2, Link2Off } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function ImageProperties() {
  const duration = useEditorStore((s) => s.duration);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const imageLayers = useEditorStore((s) => s.imageLayers);
  const galleryImages = useEditorStore((s) => s.galleryImages);
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const deleteImageLayer = useEditorStore((s) => s.deleteImageLayer);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  const layer = useMemo(
    () =>
      selectedLayerId == null
        ? undefined
        : imageLayers.find((l) => l.id === selectedLayerId && l.type === 'image'),
    [imageLayers, selectedLayerId],
  );

  const galleryMeta = useMemo(
    () =>
      layer == null
        ? undefined
        : galleryImages.find((g) => g.id === layer.galleryImageId),
    [galleryImages, layer],
  );

  const aspect = useMemo(() => {
    if (layer == null) return 1;
    if (galleryMeta && galleryMeta.width > 0) {
      return galleryMeta.height / galleryMeta.width;
    }
    return layer.height > 0 && layer.width > 0 ? layer.height / layer.width : 1;
  }, [galleryMeta, layer]);

  const onWidthChange = useCallback(
    (raw: number) => {
      if (layer == null || !Number.isFinite(raw)) return;
      const w = Math.max(8, raw);
      if (layer.lockAspectRatio) {
        const h = Math.max(8, w * aspect);
        updateImageLayer(layer.id, { width: w, height: h });
      } else {
        updateImageLayer(layer.id, { width: w });
      }
    },
    [aspect, layer, updateImageLayer],
  );

  const onHeightChange = useCallback(
    (raw: number) => {
      if (layer == null || !Number.isFinite(raw)) return;
      const h = Math.max(8, raw);
      if (layer.lockAspectRatio) {
        const w = Math.max(8, h / aspect);
        updateImageLayer(layer.id, { width: w, height: h });
      } else {
        updateImageLayer(layer.id, { height: h });
      }
    },
    [aspect, layer, updateImageLayer],
  );

  if (layer == null) {
    return null;
  }

  const displayName = galleryMeta?.name ?? 'Image';

  return (
    <div className="flex flex-col gap-4 p-3">
      <section className="flex flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={layer.src}
          alt=""
          className="max-h-[60px] w-full object-contain"
        />
        <p className="max-w-full truncate text-center text-[10px] text-zinc-500" title={displayName}>
          {displayName}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Transform
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
                updateImageLayer(layer.id, { x: v });
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
                updateImageLayer(layer.id, { y: v });
              }}
              className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </label>
        </div>
        <div className="mt-2 flex items-end gap-1">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-400">
            <span>W</span>
            <input
              type="number"
              min={8}
              value={Math.round(layer.width)}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </label>
          <button
            type="button"
            title={layer.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
              layer.lockAspectRatio
                ? 'border-[#534AB7] bg-[#534AB7] text-white'
                : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() =>
              updateImageLayer(layer.id, { lockAspectRatio: !layer.lockAspectRatio })
            }
          >
            {layer.lockAspectRatio ? (
              <Link2 className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
          </button>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-400">
            <span>H</span>
            <input
              type="number"
              min={8}
              value={Math.round(layer.height)}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Rotation
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={Math.round(layer.rotation)}
              onChange={(e) =>
                updateImageLayer(layer.id, { rotation: Number(e.target.value) })
              }
              className="min-w-0 flex-1 accent-[#534AB7]"
            />
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-300">
              {Math.round(layer.rotation)}°
            </span>
          </div>
          <button
            type="button"
            className="self-start rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
            onClick={() => updateImageLayer(layer.id, { rotation: 0 })}
          >
            Reset
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Flip
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
              layer.flipX
                ? 'border-[#534AB7] bg-[#534AB7] text-white'
                : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
            onClick={() => updateImageLayer(layer.id, { flipX: !layer.flipX })}
          >
            Flip H
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
              layer.flipY
                ? 'border-[#534AB7] bg-[#534AB7] text-white'
                : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
            onClick={() => updateImageLayer(layer.id, { flipY: !layer.flipY })}
          >
            Flip V
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Fit mode
        </h3>
        <div className="grid grid-cols-4 gap-1">
          {(['free', 'fit', 'fill', 'stretch'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-md border px-1 py-1.5 text-[10px] font-medium capitalize ${
                layer.fitMode === mode
                  ? 'border-[#534AB7] bg-[#534AB7] text-white'
                  : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
              onClick={() => updateImageLayer(layer.id, { fitMode: mode })}
            >
              {mode}
            </button>
          ))}
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
              updateImageLayer(layer.id, {
                opacity: clamp(Number(e.target.value), 0, 100),
              })
            }
            className="min-w-0 flex-1 accent-[#534AB7]"
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
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>Start (s)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={layer.startTime}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                let start = Math.max(0, v);
                let end = layer.endTime;
                if (duration > 0) {
                  start = Math.min(start, duration);
                  end = Math.min(end, duration);
                  if (end - start < 1) {
                    end = Math.min(duration, start + 1);
                  }
                }
                updateImageLayer(layer.id, { startTime: start, endTime: end });
              }}
              className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>End (s)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={layer.endTime}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                let end = duration > 0 ? Math.min(v, duration) : v;
                let start = layer.startTime;
                if (duration > 0) {
                  start = Math.max(0, Math.min(start, duration));
                  if (end - start < 1) {
                    start = Math.max(0, end - 1);
                  }
                }
                updateImageLayer(layer.id, { startTime: start, endTime: end });
              }}
              className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-sm text-zinc-100 tabular-nums outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </label>
        </div>
      </section>

      <section>
        <button
          type="button"
          className="w-full rounded-lg bg-red-950 px-3 py-2 text-xs font-medium text-red-100 ring-1 ring-red-900 hover:bg-red-900"
          onClick={() => {
            deleteImageLayer(layer.id);
            setSelectedLayerId(null);
          }}
        >
          Delete image layer
        </button>
      </section>
    </div>
  );
}
