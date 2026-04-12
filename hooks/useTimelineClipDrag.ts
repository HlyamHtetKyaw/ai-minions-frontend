'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_CLIP_SEC = 1;

export type TimelineClipDragType = 'body' | 'left' | 'right';

type DragSession = {
  type: TimelineClipDragType;
  startClientX: number;
  trackWidth: number;
  duration: number;
  origStart: number;
  origEnd: number;
  clipEl: HTMLElement;
};

export type UseTimelineClipDragParams = {
  layerId: string;
  startTime: number;
  endTime: number;
  duration: number;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (patch: { startTime?: number; endTime?: number }) => void;
};

export type UseTimelineClipDragResult = {
  clipStyle: { left: string; width: string };
  isDragging: boolean;
  dragType: TimelineClipDragType | null;
  tooltipText: string | null;
  tooltipPosition: { x: number; y: number } | null;
  handlers: {
    onBodyMouseDown: (e: React.MouseEvent) => void;
    onLeftHandleMouseDown: (e: React.MouseEvent) => void;
    onRightHandleMouseDown: (e: React.MouseEvent) => void;
  };
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function useTimelineClipDrag({
  layerId: _layerId,
  startTime,
  endTime,
  duration,
  trackLaneRef,
  onUpdate,
}: UseTimelineClipDragParams): UseTimelineClipDragResult {
  void _layerId;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null);
  const [dragType, setDragType] = useState<TimelineClipDragType | null>(null);
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const sessionRef = useRef<DragSession | null>(null);
  const liveRef = useRef<{ start: number; end: number } | null>(null);
  const listenersRef = useRef<{
    move: (e: MouseEvent) => void;
    up: () => void;
  } | null>(null);

  const removeWindowListeners = useCallback(() => {
    const L = listenersRef.current;
    if (L) {
      window.removeEventListener('mousemove', L.move);
      window.removeEventListener('mouseup', L.up);
      listenersRef.current = null;
    }
    sessionRef.current = null;
    liveRef.current = null;
    setPreview(null);
    setDragType(null);
    setTooltipText(null);
    setTooltipPosition(null);
  }, []);

  const pixelsPerSecond = (trackWidth: number, dur: number) => {
    if (dur <= 0 || trackWidth <= 0) return 1;
    return trackWidth / dur;
  };

  useEffect(() => {
    return () => {
      removeWindowListeners();
    };
  }, [removeWindowListeners]);

  const beginDrag = useCallback(
    (
      e: React.MouseEvent,
      type: TimelineClipDragType,
      clipEl: HTMLElement,
      origStart: number,
      origEnd: number,
    ) => {
      const lane = trackLaneRef.current;
      if (!lane || duration <= 0) return;

      const trackWidth = Math.max(lane.getBoundingClientRect().width, 1);
      removeWindowListeners();

      sessionRef.current = {
        type,
        startClientX: e.clientX,
        trackWidth,
        duration,
        origStart,
        origEnd,
        clipEl,
      };
      liveRef.current = { start: origStart, end: origEnd };
      setDragType(type);
      setPreview({ start: origStart, end: origEnd });

      const updateTooltip = (clientX: number, text: string) => {
        const rect = clipEl.getBoundingClientRect();
        setTooltipText(text);
        setTooltipPosition({
          x: clientX,
          y: Math.max(8, rect.top - 8),
        });
      };

      if (type === 'body') {
        updateTooltip(
          e.clientX,
          `start: ${origStart.toFixed(1)}s — end: ${origEnd.toFixed(1)}s`,
        );
      } else if (type === 'left') {
        updateTooltip(e.clientX, `start: ${origStart.toFixed(1)}s`);
      } else {
        updateTooltip(e.clientX, `end: ${origEnd.toFixed(1)}s`);
      }

      const onMove = (ev: MouseEvent) => {
        const s = sessionRef.current;
        if (!s) return;

        const pps = pixelsPerSecond(s.trackWidth, s.duration);
        const deltaSec = (ev.clientX - s.startClientX) / pps;

        if (s.type === 'body') {
          const clipDur = s.origEnd - s.origStart;
          let newStart = s.origStart + deltaSec;
          newStart = clamp(newStart, 0, Math.max(0, s.duration - clipDur));
          const newEnd = newStart + clipDur;
          liveRef.current = { start: newStart, end: newEnd };
          setPreview({ start: newStart, end: newEnd });
          updateTooltip(
            ev.clientX,
            `start: ${newStart.toFixed(1)}s — end: ${newEnd.toFixed(1)}s`,
          );
        } else if (s.type === 'left') {
          const maxStart = s.origEnd - MIN_CLIP_SEC;
          const newStart = clamp(s.origStart + deltaSec, 0, maxStart);
          liveRef.current = { start: newStart, end: s.origEnd };
          setPreview({ start: newStart, end: s.origEnd });
          updateTooltip(ev.clientX, `start: ${newStart.toFixed(1)}s`);
        } else {
          const minEnd = s.origStart + MIN_CLIP_SEC;
          const newEnd = clamp(s.origEnd + deltaSec, minEnd, s.duration);
          liveRef.current = { start: s.origStart, end: newEnd };
          setPreview({ start: s.origStart, end: newEnd });
          updateTooltip(ev.clientX, `end: ${newEnd.toFixed(1)}s`);
        }
      };

      const onUp = () => {
        const s = sessionRef.current;
        const live = liveRef.current;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        listenersRef.current = null;
        sessionRef.current = null;
        liveRef.current = null;

        if (s && live) {
          if (s.type === 'body') {
            onUpdateRef.current({
              startTime: live.start,
              endTime: live.end,
            });
          } else if (s.type === 'left') {
            onUpdateRef.current({ startTime: live.start });
          } else {
            onUpdateRef.current({ endTime: live.end });
          }
        }

        setPreview(null);
        setDragType(null);
        setTooltipText(null);
        setTooltipPosition(null);
      };

      listenersRef.current = { move: onMove, up: onUp };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [duration, removeWindowListeners, trackLaneRef],
  );

  const onBodyMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clipEl = e.currentTarget.closest('[data-timeline-clip]') as HTMLElement | null;
      if (!clipEl) return;
      beginDrag(e, 'body', clipEl, startTime, endTime);
    },
    [beginDrag, endTime, startTime],
  );

  const onLeftHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clipEl = e.currentTarget.closest('[data-timeline-clip]') as HTMLElement | null;
      if (!clipEl) return;
      beginDrag(e, 'left', clipEl, startTime, endTime);
    },
    [beginDrag, endTime, startTime],
  );

  const onRightHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clipEl = e.currentTarget.closest('[data-timeline-clip]') as HTMLElement | null;
      if (!clipEl) return;
      beginDrag(e, 'right', clipEl, startTime, endTime);
    },
    [beginDrag, endTime, startTime],
  );

  const effectiveStart = preview?.start ?? startTime;
  const effectiveEnd = preview?.end ?? endTime;
  const span = Math.max(0, effectiveEnd - effectiveStart);
  const leftPct = duration > 0 ? (effectiveStart / duration) * 100 : 0;
  const widthPct = duration > 0 ? (span / duration) * 100 : 0;

  return {
    clipStyle: {
      left: `${leftPct}%`,
      width: `${Math.max(widthPct, 0.05)}%`,
    },
    isDragging: dragType != null,
    dragType,
    tooltipText,
    tooltipPosition,
    handlers: {
      onBodyMouseDown,
      onLeftHandleMouseDown,
      onRightHandleMouseDown,
    },
  };
}
