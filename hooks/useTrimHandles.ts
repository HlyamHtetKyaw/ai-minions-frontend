'use client';

import { useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';

const MIN_TRIM_GAP = 1;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export type TrimHandleTooltip = {
  text: string;
  x: number;
  y: number;
};

type UseTrimHandlesParams = {
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
};

export function useTrimHandles({ trackLaneRef, duration }: UseTrimHandlesParams) {
  const [leftTooltip, setLeftTooltip] = useState<TrimHandleTooltip | null>(null);
  const [rightTooltip, setRightTooltip] = useState<TrimHandleTooltip | null>(null);

  const onLeftHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const lane = trackLaneRef.current;
      const v = useEditorStore.getState().videoElement;
      const setTrimStart = useEditorStore.getState().setTrimStart;
      const setCurrentTime = useEditorStore.getState().setCurrentTime;
      if (!lane || !v || duration <= 0 || !Number.isFinite(duration)) return;

      const rect = lane.getBoundingClientRect();
      const trackWidth = Math.max(rect.width, 1);
      const pps = trackWidth / duration;
      const startX = e.clientX;
      const origTrimStart = useEditorStore.getState().trimStart;

      const updateTooltip = (clientX: number, trimStart: number) => {
        const r = lane.getBoundingClientRect();
        setLeftTooltip({
          text: `Start: ${trimStart.toFixed(1)}s`,
          x: clientX,
          y: Math.max(8, r.top - 8),
        });
      };
      updateTooltip(e.clientX, origTrimStart);

      const onMove = (ev: MouseEvent) => {
        const { trimEnd } = useEditorStore.getState();
        const delta = (ev.clientX - startX) / pps;
        const maxStart = Math.max(0, trimEnd - MIN_TRIM_GAP);
        const newTrimStart = clamp(origTrimStart + delta, 0, maxStart);
        setTrimStart(newTrimStart);
        v.currentTime = newTrimStart;
        setCurrentTime(newTrimStart);
        updateTooltip(ev.clientX, newTrimStart);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setLeftTooltip(null);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [duration, trackLaneRef],
  );

  const onRightHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const lane = trackLaneRef.current;
      const v = useEditorStore.getState().videoElement;
      const setTrimEnd = useEditorStore.getState().setTrimEnd;
      const setCurrentTime = useEditorStore.getState().setCurrentTime;
      if (!lane || !v || duration <= 0 || !Number.isFinite(duration)) return;

      const rect = lane.getBoundingClientRect();
      const trackWidth = Math.max(rect.width, 1);
      const pps = trackWidth / duration;
      const startX = e.clientX;
      const origTrimEnd = useEditorStore.getState().trimEnd;

      const updateTooltip = (clientX: number, trimEnd: number) => {
        const r = lane.getBoundingClientRect();
        setRightTooltip({
          text: `End: ${trimEnd.toFixed(1)}s`,
          x: clientX,
          y: Math.max(8, r.top - 8),
        });
      };
      updateTooltip(e.clientX, origTrimEnd);

      const onMove = (ev: MouseEvent) => {
        const { trimStart, duration: d } = useEditorStore.getState();
        const delta = (ev.clientX - startX) / pps;
        const minEnd = trimStart + MIN_TRIM_GAP;
        const newTrimEnd = clamp(origTrimEnd + delta, minEnd, d);
        setTrimEnd(newTrimEnd);
        v.currentTime = newTrimEnd;
        setCurrentTime(newTrimEnd);
        updateTooltip(ev.clientX, newTrimEnd);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setRightTooltip(null);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [duration, trackLaneRef],
  );

  return {
    leftTooltip,
    rightTooltip,
    onLeftHandleMouseDown,
    onRightHandleMouseDown,
  };
}
