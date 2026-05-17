'use client';

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

type NormalizedPoint = { x: number; y: number };

type UsePointerNormalizedDragOptions = {
  enabled: boolean;
  boundsRef: RefObject<HTMLElement | null>;
  position: NormalizedPoint;
  onPositionChange: (next: NormalizedPoint) => void;
};

/**
 * Drag within a bounds element using normalized 0–1 coordinates.
 * Window-level pointer listeners + touch-action:none prevent page scroll on phones.
 */
export function usePointerNormalizedDrag({
  enabled,
  boundsRef,
  position,
  onPositionChange,
}: UsePointerNormalizedDragOptions) {
  const positionRef = useRef(position);
  const onChangeRef = useRef(onPositionChange);
  positionRef.current = position;
  onChangeRef.current = onPositionChange;

  const sessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const listenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  const removeListeners = useCallback(() => {
    const L = listenersRef.current;
    if (!L) return;
    window.removeEventListener('pointermove', L.move);
    window.removeEventListener('pointerup', L.up);
    window.removeEventListener('pointercancel', L.up);
    listenersRef.current = null;
    sessionRef.current = null;
  }, []);

  useEffect(() => () => removeListeners(), [removeListeners]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const bounds = boundsRef.current;
      if (!bounds) return;

      e.preventDefault();
      e.stopPropagation();

      sessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseX: positionRef.current.x,
        baseY: positionRef.current.y,
      };

      const captureEl = e.currentTarget as HTMLElement;
      try {
        captureEl.setPointerCapture(e.pointerId);
      } catch {
        /* unsupported */
      }

      const onMove = (ev: PointerEvent) => {
        const session = sessionRef.current;
        if (!session || ev.pointerId !== session.pointerId) return;
        const el = boundsRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dx = (ev.clientX - session.startX) / Math.max(1, rect.width);
        const dy = (ev.clientY - session.startY) / Math.max(1, rect.height);
        onChangeRef.current({
          x: Math.max(0, Math.min(1, session.baseX + dx)),
          y: Math.max(0, Math.min(1, session.baseY + dy)),
        });
        ev.preventDefault();
      };

      const onUp = (ev: PointerEvent) => {
        const session = sessionRef.current;
        if (!session || ev.pointerId !== session.pointerId) return;
        removeListeners();
        try {
          captureEl.releasePointerCapture(ev.pointerId);
        } catch {
          /* released */
        }
      };

      removeListeners();
      listenersRef.current = { move: onMove, up: onUp };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [boundsRef, enabled, removeListeners],
  );

  return { onPointerDown };
}
