'use client';

import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { useRndLiveBounds } from '@/hooks/useRndLiveBounds';
import { useTextLayerBoxResize } from '@/hooks/useTextLayerBoxResize';
import { useViralOverlayStore } from '@/features/viral-shorts/viral-overlay-store';
import type { TextLayer as TextLayerType } from '@/store/editorStore';

const cornerHandle = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
};

type ViralTextLayerProps = {
  layer: TextLayerType;
  currentTimeSec: number;
  stackIndex?: number;
  scale?: number;
};

export function ViralTextLayer({ layer, currentTimeSec, stackIndex = 0, scale = 1 }: ViralTextLayerProps) {
  const activeTool = useViralOverlayStore((s) => s.activeTool);
  const selectedLayerId = useViralOverlayStore((s) => s.selectedLayerId);
  const updateTextLayer = useViralOverlayStore((s) => s.updateTextLayer);
  const setSelectedLayerId = useViralOverlayStore((s) => s.setSelectedLayerId);
  const setActiveTool = useViralOverlayStore((s) => s.setActiveTool);

  const selected = layer.id === selectedLayerId;
  const interactiveOnCanvas = selected;

  const storedBounds = {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
  };
  const { bounds, onDrag, onResize, clearLive, isLive } = useRndLiveBounds(storedBounds);

  const beginTransform = useCallback(() => {}, []);
  const endTransform = useCallback(() => {
    clearLive();
  }, [clearLive]);

  const onDragStart = useCallback(() => {
    beginTransform();
  }, [beginTransform]);

  const onDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      updateTextLayer(layer.id, { x: d.x, y: d.y });
      endTransform();
    },
    [endTransform, layer.id, updateTextLayer],
  );

  const { displayFontSize, onResizeStart, onResizeStop } = useTextLayerBoxResize(
    layer,
    bounds,
    isLive,
    updateTextLayer,
    beginTransform,
    endTransform,
  );

  if (currentTimeSec < layer.startTime || currentTimeSec > layer.endTime) {
    return null;
  }

  const zIndex = 40 + stackIndex + (selected ? 50 : 0);

  return (
    <Rnd
      bounds="parent"
      scale={scale}
      size={{ width: bounds.width, height: bounds.height }}
      position={{ x: bounds.x, y: bounds.y }}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragStop={onDragStop}
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeStop={onResizeStop}
      enableUserSelectHack={false}
      enableResizing={
        interactiveOnCanvas
          ? {
              top: false,
              right: false,
              bottom: false,
              left: false,
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
        willChange: isLive ? 'transform' : undefined,
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
        setActiveTool('text');
      }}
      onClick={(e: ReactMouseEvent) => {
        e.stopPropagation();
      }}
      resizeHandleStyles={
        interactiveOnCanvas
          ? {
              topLeft: cornerHandle,
              topRight: cornerHandle,
              bottomLeft: cornerHandle,
              bottomRight: cornerHandle,
            }
          : undefined
      }
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          border: selected
            ? '1px dashed rgba(127, 119, 221, 0.8)'
            : '1px solid transparent',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="w-full px-1 text-center"
          style={{
            fontSize: `${displayFontSize}px`,
            fontFamily: `"Pyidaungsu", "Noto Sans Myanmar", "Myanmar Text", sans-serif`,
            color: layer.color,
            opacity: layer.opacity / 100,
            userSelect: 'none',
            pointerEvents: 'none',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {layer.content}
        </div>
      </div>
    </Rnd>
  );
}
