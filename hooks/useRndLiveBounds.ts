import { useCallback, useState } from 'react';

export type RndRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Keeps drag/resize smooth while the parent re-renders (e.g. playhead ticks). */
export function useRndLiveBounds(stored: RndRect) {
  const [live, setLive] = useState<RndRect | null>(null);

  const bounds: RndRect = live ?? stored;

  const onDrag = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      setLive((prev) => ({
        x: d.x,
        y: d.y,
        width: prev?.width ?? stored.width,
        height: prev?.height ?? stored.height,
      }));
    },
    [stored.width, stored.height],
  );

  const onResize = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      position: { x: number; y: number },
    ) => {
      setLive({
        x: position.x,
        y: position.y,
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    },
    [],
  );

  const clearLive = useCallback(() => {
    setLive(null);
  }, []);

  return { bounds, onDrag, onResize, clearLive, isLive: live != null };
}
