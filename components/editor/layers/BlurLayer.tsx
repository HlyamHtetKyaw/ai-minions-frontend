'use client';

import { useCallback, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { useRndLiveBounds } from '@/hooks/useRndLiveBounds';
import { blurResizeEnabled, blurResizeHandleStyles } from '@/lib/rnd-blur-resize-handles';
import { useEditorStore } from '@/store/editorStore';
import type { BlurLayer as BlurLayerType } from '@/store/editorStore';

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
  const setCanvasTransformingLayerId = useEditorStore((s) => s.setCanvasTransformingLayerId);

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

  const storedBounds = {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
  };
  const { bounds, onDrag, onResize, clearLive, isLive } = useRndLiveBounds(storedBounds);

  useEffect(() => {
    return () => {
      if (useEditorStore.getState().canvasTransformingLayerId === layer.id) {
        setCanvasTransformingLayerId(null);
      }
    };
  }, [layer.id, setCanvasTransformingLayerId]);

  const beginTransform = useCallback(() => {
    setCanvasTransformingLayerId(layer.id);
  }, [layer.id, setCanvasTransformingLayerId]);

  const endTransform = useCallback(() => {
    setCanvasTransformingLayerId(null);
    clearLive();
  }, [clearLive, setCanvasTransformingLayerId]);

  const onDragStart = useCallback(() => {
    beginTransform();
  }, [beginTransform]);

  const onDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      updateBlurLayer(layer.id, { x: d.x, y: d.y });
      endTransform();
    },
    [endTransform, layer.id, updateBlurLayer],
  );

  const onResizeStart = useCallback(() => {
    beginTransform();
  }, [beginTransform]);

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
      endTransform();
    },
    [endTransform, layer.id, updateBlurLayer],
  );

  if (currentTime < layer.startTime || currentTime > layer.endTime) {
    return null;
  }

  const zIndex = 20 + stackIndex + (selected ? 50 : 0);

  return (
    <Rnd
      bounds="parent"
      size={{ width: bounds.width, height: bounds.height }}
      position={{ x: bounds.x, y: bounds.y }}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragStop={onDragStop}
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeStop={onResizeStop}
      enableUserSelectHack={false}
      enableResizing={interactiveOnCanvas ? blurResizeEnabled : false}
      disableDragging={!interactiveOnCanvas}
      className={interactiveOnCanvas ? 'touch-none' : undefined}
      resizeHandleWrapperStyle={interactiveOnCanvas ? { touchAction: 'none' } : undefined}
      style={{
        zIndex,
        pointerEvents: interactiveOnCanvas ? 'auto' : 'none',
        touchAction: interactiveOnCanvas ? 'none' : undefined,
        willChange: isLive ? 'transform' : undefined,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
      }}
      onClick={(e: ReactMouseEvent) => {
        e.stopPropagation();
      }}
      resizeHandleStyles={interactiveOnCanvas ? blurResizeHandleStyles : undefined}
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
          background: supportsBackdropBlur
            ? 'rgba(255,255,255,0.05)'
            : `linear-gradient(135deg, rgba(12,12,14,${Math.min(0.56, 0.24 + intensity * 0.012)}), rgba(28,28,34,${Math.min(0.46, 0.18 + intensity * 0.01)}))`,
          boxShadow: supportsBackdropBlur ? undefined : 'inset 0 0 0 9999px rgba(0,0,0,0.06)',
          isolation: 'isolate',
          willChange: supportsBackdropBlur ? 'backdrop-filter' : undefined,
          pointerEvents: 'none',
        }}
      />
    </Rnd>
  );
}
