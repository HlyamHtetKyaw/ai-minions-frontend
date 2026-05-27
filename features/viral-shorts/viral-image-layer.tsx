'use client';

import {
  useCallback,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Rnd } from 'react-rnd';
import { useViralOverlayStore } from '@/features/viral-shorts/viral-overlay-store';
import type { ImageLayer as ImageLayerType } from '@/store/editorStore';

const handleStyle = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
};

type ViralImageLayerProps = {
  layer: ImageLayerType;
  currentTimeSec: number;
  stackIndex?: number;
  scale?: number;
};

function objectFitForMode(mode: ImageLayerType['fitMode']): CSSProperties['objectFit'] {
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

export function ViralImageLayer({
  layer,
  currentTimeSec,
  stackIndex = 0,
  scale = 1,
}: ViralImageLayerProps) {
  const activeTool = useViralOverlayStore((s) => s.activeTool);
  const selectedLayerId = useViralOverlayStore((s) => s.selectedLayerId);
  const updateImageLayer = useViralOverlayStore((s) => s.updateImageLayer);
  const setSelectedLayerId = useViralOverlayStore((s) => s.setSelectedLayerId);
  const setActiveTool = useViralOverlayStore((s) => s.setActiveTool);

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

  if (currentTimeSec < layer.startTime || currentTimeSec > layer.endTime) {
    return null;
  }

  const zIndex = 35 + stackIndex + (selected ? 50 : 0);

  return (
    <Rnd
      bounds="parent"
      scale={scale}
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
      className={interactiveOnCanvas ? 'touch-none' : undefined}
      style={{
        zIndex,
        pointerEvents: interactiveOnCanvas ? 'auto' : 'none',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
        setActiveTool('image');
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
