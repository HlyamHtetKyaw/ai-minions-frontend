'use client';

import {
  useCallback,
  useEffect,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { Rnd } from 'react-rnd';
import { useRndLiveBounds } from '@/hooks/useRndLiveBounds';
import { useTextLayerBoxResize } from '@/hooks/useTextLayerBoxResize';
import {
  captionBoxBackgroundCss,
  resolveCaptionBackgroundColor,
  resolveCaptionBackgroundOpacity,
} from '@/lib/text-layer-caption-style';
import { useEditorStore } from '@/store/editorStore';
import type { TextLayer as TextLayerType } from '@/store/editorStore';
import { textLayerSelectionStyle } from '@/lib/canvas-text-selection-style';
import {
  overlayResizeEnabled,
  textOverlayResizeHandleStyles,
} from '@/lib/rnd-blur-resize-handles';

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

  const captionBackground = captionBoxBackgroundCss(
    resolveCaptionBackgroundColor(layer),
    resolveCaptionBackgroundOpacity(layer),
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
      enableResizing={interactiveOnCanvas ? overlayResizeEnabled : false}
      disableDragging={!interactiveOnCanvas}
      className={interactiveOnCanvas ? 'touch-none' : undefined}
      resizeHandleWrapperStyle={interactiveOnCanvas ? { touchAction: 'none' } : undefined}
      style={{
        zIndex,
        willChange: isLive ? 'transform' : undefined,
        // Let clicks reach the <video> unless the text tool is active (same pattern as blur).
        pointerEvents: interactiveOnCanvas ? 'auto' : 'none',
        touchAction: interactiveOnCanvas ? 'none' : undefined,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
      }}
      onTouchStart={(e: ReactTouchEvent) => {
        if (!interactiveOnCanvas) return;
        e.stopPropagation();
      }}
      onClick={(e: ReactMouseEvent) => {
        e.stopPropagation();
      }}
      resizeHandleStyles={interactiveOnCanvas ? textOverlayResizeHandleStyles : undefined}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          ...textLayerSelectionStyle(selected),
          boxSizing: 'border-box',
        }}
      >
        <div
          className="max-w-full rounded px-1 py-0.5 text-center"
          style={{
            backgroundColor: captionBackground,
          }}
        >
          <div
            className="w-full"
            style={{
              fontSize: `${displayFontSize}px`,
              fontFamily: `"Pyidaungsu", "Noto Sans Myanmar", "Myanmar Text", sans-serif`,
              color: layer.color,
              opacity: layer.opacity / 100,
              userSelect: 'none',
              pointerEvents: 'none',
              lineHeight: 1.25,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {layer.content}
          </div>
        </div>
      </div>
    </Rnd>
  );
}
