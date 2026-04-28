'use client';

import { useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '@/store/editorStore';
import type { BlurLayer as BlurLayerType } from '@/store/editorStore';

const handleStyle = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
};

type BlurLayerProps = {
  layer: BlurLayerType;
  stackIndex?: number;
};

export function BlurLayer({ layer, stackIndex = 0 }: BlurLayerProps) {
  const currentTime = useEditorStore((s) => s.currentTime);
  const intensity = useEditorStore(
    (s) => s.blurLayers.find((l) => l.id === layer.id)?.intensity ?? layer.intensity,
  );
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateBlurLayer = useEditorStore((s) => s.updateBlurLayer);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  const selected = layer.id === selectedLayerId;
  const supportsBackdropBlur = useMemo(() => {
    if (typeof window === 'undefined' || typeof CSS === 'undefined') return true;
    return (
      CSS.supports('backdrop-filter: blur(2px)') ||
      CSS.supports('-webkit-backdrop-filter: blur(2px)')
    );
  }, []);
  /** Only capture pointer events while the blur tool is active so native video controls stay usable. */
  const interactiveOnCanvas = selected && activeTool === 'blur';

  const onDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      updateBlurLayer(layer.id, { x: d.x, y: d.y });
    },
    [layer.id, updateBlurLayer],
  );

  const onResizeStop = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      position: { x: number; y: number },
    ) => {
      updateBlurLayer(layer.id, {
        x: position.x,
        y: position.y,
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    },
    [layer.id, updateBlurLayer],
  );

  if (currentTime < layer.startTime || currentTime > layer.endTime) {
    return null;
  }

  const zIndex = 20 + stackIndex + (selected ? 50 : 0);

  return (
    <Rnd
      bounds="parent"
      size={{ width: layer.width, height: layer.height }}
      position={{ x: layer.x, y: layer.y }}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
      enableResizing={
        interactiveOnCanvas
          ? {
              top: true,
              right: true,
              bottom: true,
              left: true,
              topRight: true,
              topLeft: true,
              bottomRight: true,
              bottomLeft: true,
            }
          : false
      }
      disableDragging={!interactiveOnCanvas}
      style={{
        zIndex,
        pointerEvents: interactiveOnCanvas ? 'auto' : 'none',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
      }}
      onClick={(e: ReactMouseEvent) => {
        e.stopPropagation();
      }}
      resizeHandleStyles={
        interactiveOnCanvas
          ? {
              top: handleStyle,
              right: handleStyle,
              bottom: handleStyle,
              left: handleStyle,
              topLeft: handleStyle,
              topRight: handleStyle,
              bottomLeft: handleStyle,
              bottomRight: handleStyle,
            }
          : undefined
      }
    >
      <div
        className="h-full w-full overflow-hidden"
        style={{
          border: selected
            ? '1px dashed rgba(93,202,165,0.8)'
            : '1px dashed rgba(93,202,165,0.2)',
          boxSizing: 'border-box',
          opacity: layer.opacity / 100,
          backdropFilter: supportsBackdropBlur ? `blur(${intensity}px)` : undefined,
          WebkitBackdropFilter: supportsBackdropBlur ? `blur(${intensity}px)` : undefined,
          // Fallback for browsers without backdrop-filter (notably some Firefox setups):
          // keep a visible "obscured" region so preview remains usable.
          background: supportsBackdropBlur
            ? 'rgba(255,255,255,0.05)'
            : `linear-gradient(135deg, rgba(12,12,14,${Math.min(0.56, 0.24 + intensity * 0.012)}), rgba(28,28,34,${Math.min(0.46, 0.18 + intensity * 0.01)}))`,
          boxShadow: supportsBackdropBlur ? undefined : 'inset 0 0 0 9999px rgba(0,0,0,0.06)',
          isolation: 'isolate',
          willChange: supportsBackdropBlur ? 'backdrop-filter' : undefined,
        }}
      />
    </Rnd>
  );
}
