'use client';

import { useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { useViralOverlayStore } from '@/features/viral-shorts/viral-overlay-store';
import type { BlurLayer as BlurLayerType } from '@/store/editorStore';

const handleStyle = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
};

type ViralBlurLayerProps = {
  layer: BlurLayerType;
  currentTimeSec: number;
  stackIndex?: number;
  scale?: number;
};

export function ViralBlurLayer({ layer, currentTimeSec, stackIndex = 0, scale = 1 }: ViralBlurLayerProps) {
  const activeTool = useViralOverlayStore((s) => s.activeTool);
  const selectedLayerId = useViralOverlayStore((s) => s.selectedLayerId);
  const updateBlurLayer = useViralOverlayStore((s) => s.updateBlurLayer);
  const setSelectedLayerId = useViralOverlayStore((s) => s.setSelectedLayerId);
  const setActiveTool = useViralOverlayStore((s) => s.setActiveTool);

  const selected = layer.id === selectedLayerId;
  const supportsBackdropBlur = useMemo(() => {
    if (typeof window === 'undefined' || typeof CSS === 'undefined') return true;
    return (
      CSS.supports('backdrop-filter: blur(2px)') ||
      CSS.supports('-webkit-backdrop-filter: blur(2px)')
    );
  }, []);

  const interactiveOnCanvas = selected;

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

  if (currentTimeSec < layer.startTime || currentTimeSec > layer.endTime) {
    return null;
  }

  const zIndex = 25 + stackIndex + (selected ? 50 : 0);

  return (
    <Rnd
      bounds="parent"
      scale={scale}
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
      className={interactiveOnCanvas ? 'touch-none' : undefined}
      style={{
        zIndex,
        pointerEvents: 'auto',
        touchAction: interactiveOnCanvas ? 'none' : undefined,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
        setActiveTool('blur');
      }}
      onTouchStart={(e) => {
        if (!interactiveOnCanvas) return;
        e.stopPropagation();
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
          backdropFilter: supportsBackdropBlur ? `blur(${layer.intensity}px)` : undefined,
          WebkitBackdropFilter: supportsBackdropBlur ? `blur(${layer.intensity}px)` : undefined,
          background: supportsBackdropBlur
            ? 'rgba(255,255,255,0.05)'
            : `linear-gradient(135deg, rgba(12,12,14,${Math.min(0.56, 0.24 + layer.intensity * 0.012)}), rgba(28,28,34,${Math.min(0.46, 0.18 + layer.intensity * 0.01)}))`,
          boxShadow: supportsBackdropBlur ? undefined : 'inset 0 0 0 9999px rgba(0,0,0,0.06)',
          isolation: 'isolate',
          willChange: supportsBackdropBlur ? 'backdrop-filter' : undefined,
        }}
      />
    </Rnd>
  );
}
