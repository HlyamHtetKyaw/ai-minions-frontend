import { useCallback, useMemo, useState } from 'react';
import type { RndRect } from '@/hooks/useRndLiveBounds';
import { scaleTextLayerFontSize } from '@/lib/text-layer-font-scale';

type TextLayerBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

type ResizeBase = {
  width: number;
  height: number;
  fontSize: number;
};

export function useTextLayerBoxResize(
  layer: TextLayerBox,
  bounds: RndRect,
  isLive: boolean,
  updateTextLayer: (id: string, patch: Partial<TextLayerBox>) => void,
  onResizeStartExternal?: () => void,
  onResizeStopExternal?: () => void,
) {
  const [resizeBase, setResizeBase] = useState<ResizeBase | null>(null);

  const displayFontSize = useMemo(() => {
    if (resizeBase != null && isLive) {
      return scaleTextLayerFontSize(
        resizeBase.fontSize,
        resizeBase.width,
        resizeBase.height,
        bounds.width,
        bounds.height,
      );
    }
    return layer.fontSize;
  }, [
    resizeBase,
    isLive,
    bounds.width,
    bounds.height,
    layer.fontSize,
  ]);

  const onResizeStart = useCallback(() => {
    onResizeStartExternal?.();
    setResizeBase({
      width: layer.width,
      height: layer.height,
      fontSize: layer.fontSize,
    });
  }, [layer.width, layer.height, layer.fontSize, onResizeStartExternal]);

  const onResizeStop = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      position: { x: number; y: number },
    ) => {
      const nextW = ref.offsetWidth;
      const nextH = ref.offsetHeight;
      const base = resizeBase ?? {
        width: layer.width,
        height: layer.height,
        fontSize: layer.fontSize,
      };
      updateTextLayer(layer.id, {
        x: position.x,
        y: position.y,
        width: nextW,
        height: nextH,
        fontSize: scaleTextLayerFontSize(
          base.fontSize,
          base.width,
          base.height,
          nextW,
          nextH,
        ),
      });
      setResizeBase(null);
      onResizeStopExternal?.();
    },
    [
      layer.id,
      layer.width,
      layer.height,
      layer.fontSize,
      resizeBase,
      updateTextLayer,
      onResizeStopExternal,
    ],
  );

  return { displayFontSize, onResizeStart, onResizeStop };
}
