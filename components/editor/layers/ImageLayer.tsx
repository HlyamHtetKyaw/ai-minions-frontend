'use client';

import {
  useCallback,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '@/store/editorStore';
import type { ImageLayer as ImageLayerModel } from '@/store/editorStore';

const handleStyle = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
};

type ImageLayerProps = {
  layer: ImageLayerModel;
  stackIndex: number;
};

function objectFitForMode(mode: ImageLayerModel['fitMode']): CSSProperties['objectFit'] {
  switch (mode) {
    case 'fit':
      return 'contain';
    case 'fill':
      return 'cover';
    case 'free':
    case 'stretch':
    default:
      return 'fill';
  }
}

export function ImageLayer({ layer, stackIndex }: ImageLayerProps) {
  const currentTime = useEditorStore((s) => s.currentTime);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  const boxRef = useRef<HTMLDivElement | null>(null);

  const selected = layer.id === selectedLayerId;
  const interactiveOnCanvas = selected && activeTool === 'image';

  const onDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      updateImageLayer(layer.id, { x: d.x, y: d.y });
    },
    [layer.id, updateImageLayer],
  );

  const onResizeStop = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      position: { x: number; y: number },
    ) => {
      updateImageLayer(layer.id, {
        x: position.x,
        y: position.y,
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    },
    [layer.id, updateImageLayer],
  );

  const onRotationHandleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const onMove = (ev: MouseEvent) => {
        const el = boxRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const angle =
          Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI) + 90;
        updateImageLayer(layer.id, { rotation: angle });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [layer.id, updateImageLayer],
  );

  if (currentTime < layer.startTime || currentTime > layer.endTime) {
    return null;
  }

  const zIndex = 10 + stackIndex + (selected ? 50 : 0);

  return (
    <Rnd
      bounds="parent"
      size={{ width: layer.width, height: layer.height }}
      position={{ x: layer.x, y: layer.y }}
      lockAspectRatio={layer.lockAspectRatio}
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
      <div ref={boxRef} className="relative h-full w-full">
        {selected && (
          <>
            <div
              className="pointer-events-none absolute left-1/2 h-4 w-px -translate-x-1/2 bg-[#EF9F27]"
              style={{ top: -16 }}
              aria-hidden
            />
            <button
              type="button"
              aria-label="Rotate image layer"
              className="absolute left-1/2 -translate-x-1/2 cursor-grab rounded-full border border-[#EF9F27] bg-white shadow-sm active:cursor-grabbing"
              style={{ top: -32, width: 16, height: 16 }}
              onMouseDown={onRotationHandleMouseDown}
            />
          </>
        )}
        <div
          className="h-full w-full overflow-hidden"
          style={{
            border: selected ? '1px dashed rgba(239,159,39,0.8)' : 'none',
            boxSizing: 'border-box',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layer.src}
            alt=""
            draggable={false}
            className="h-full w-full"
            style={{
              objectFit: objectFitForMode(layer.fitMode),
              opacity: layer.opacity / 100,
              transform: `rotate(${layer.rotation}deg) scaleX(${layer.flipX ? -1 : 1}) scaleY(${layer.flipY ? -1 : 1})`,
            }}
          />
        </div>
      </div>
    </Rnd>
  );
}
