'use client';

import { useCallback, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { useRndLiveBounds } from '@/hooks/useRndLiveBounds';
import { useTextLayerBoxResize } from '@/hooks/useTextLayerBoxResize';
import { useEditorStore } from '@/store/editorStore';
import type { TextLayer as TextLayerType } from '@/store/editorStore';

const cornerHandle = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
};

type TextLayerProps = {
  layer: TextLayerType;
  stackIndex?: number;
};

export function TextLayer({ layer, stackIndex = 0 }: TextLayerProps) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const setCanvasTransformingLayerId = useEditorStore((s) => s.setCanvasTransformingLayerId);

  const selected = layer.id === selectedLayerId;
  const interactiveOnCanvas = selected && activeTool === 'text';

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
      updateTextLayer(layer.id, { x: d.x, y: d.y });
      endTransform();
    },
    [endTransform, layer.id, updateTextLayer],
  );

  const zIndex = 30 + stackIndex + (selected ? 50 : 0);

  const { displayFontSize, onResizeStart, onResizeStop } = useTextLayerBoxResize(
    layer,
    bounds,
    isLive,
    updateTextLayer,
    beginTransform,
    endTransform,
  );

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
        // Let clicks reach the <video> unless the text tool is active (same pattern as blur).
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
            // Keep video-editor text rendering aligned with Viral flow (Pyidaungsu-first fallback stack).
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
