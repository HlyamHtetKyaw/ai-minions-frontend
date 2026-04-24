'use client';

import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
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

  const selected = layer.id === selectedLayerId;
  const interactiveOnCanvas = selected && activeTool === 'text';

  const onDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      updateTextLayer(layer.id, { x: d.x, y: d.y });
    },
    [layer.id, updateTextLayer],
  );

  const zIndex = 30 + stackIndex + (selected ? 50 : 0);

  const onResizeStop = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      position: { x: number; y: number },
    ) => {
      updateTextLayer(layer.id, {
        x: position.x,
        y: position.y,
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    },
    [layer.id, updateTextLayer],
  );

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
            fontSize: `${layer.fontSize}px`,
            // Myanmar Unicode falls through when the chosen display font has no glyphs (matches export + Viral subtitle stack).
            fontFamily: `"${layer.fontFamily}", "Noto Sans Myanmar", "Pyidaungsu", "Myanmar Text", sans-serif`,
            color: layer.color,
            opacity: layer.opacity / 100,
            userSelect: 'none',
            pointerEvents: 'none',
            lineHeight: 1.2,
            wordBreak: 'break-word',
          }}
        >
          {layer.content}
        </div>
      </div>
    </Rnd>
  );
}
