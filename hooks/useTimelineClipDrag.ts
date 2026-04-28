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
  /** When set, called with normalized positions (0–1 along timeline) to draw vertical guide lines; `null` when drag ends. */
  onDragGuideLines?: (ratios: number[] | null) => void;
  currentRowId?: string;
  onMoveToRow?: (targetRowId: string) => void;
  onLiveUpdate?: (timeSec: number | null) => void;
  snapPointsSec?: number[];
  snapThresholdPx?: number;
};

export type UseTimelineClipDragResult = {
  clipStyle: { left: string; width: string };
  isDragging: boolean;
  dragType: TimelineClipDragType | null;
  previewRange: { start: number; end: number } | null;
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
  onDragGuideLines,
  currentRowId,
  onMoveToRow,
  onLiveUpdate,
  snapPointsSec,
  snapThresholdPx = 8,
}: UseTimelineClipDragParams): UseTimelineClipDragResult {
  void _layerId;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onDragGuideLinesRef = useRef(onDragGuideLines);
  onDragGuideLinesRef.current = onDragGuideLines;
  const onLiveUpdateRef = useRef(onLiveUpdate);
  onLiveUpdateRef.current = onLiveUpdate;
  const snapPointsRef = useRef(snapPointsSec ?? []);
  snapPointsRef.current = snapPointsSec ?? [];

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
    onDragGuideLinesRef.current?.(null);
    onLiveUpdateRef.current?.(null);
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

      const reportGuideLines = (live: { start: number; end: number }) => {
        const fn = onDragGuideLinesRef.current;
        if (!fn || duration <= 0) return;
        if (type === 'body') {
          fn([live.start / duration, live.end / duration]);
        } else if (type === 'left') {
          fn([live.start / duration]);
        } else {
          fn([live.end / duration]);
        }
      };
      reportGuideLines({ start: origStart, end: origEnd });

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

      let hoveredRowId = currentRowId;

      const onMove = (ev: MouseEvent) => {
        const s = sessionRef.current;
        if (!s) return;

        const pps = pixelsPerSecond(s.trackWidth, s.duration);
        const deltaSec = (ev.clientX - s.startClientX) / pps;
        const snapThresholdSec = Math.max(0, snapThresholdPx / pps);
        const snapToNearest = (raw: number) => {
          const points = snapPointsRef.current;
          if (points.length === 0) return raw;
          let snapped = raw;
          let nearestDiff = Number.POSITIVE_INFINITY;
          for (const point of points) {
            const diff = Math.abs(point - raw);
            if (diff < nearestDiff) {
              nearestDiff = diff;
              snapped = point;
            }
          }
          return nearestDiff <= snapThresholdSec ? snapped : raw;
        };

        if (s.type === 'body') {
          const clipDur = s.origEnd - s.origStart;
          let newStart = s.origStart + deltaSec;
          newStart = clamp(newStart, 0, Math.max(0, s.duration - clipDur));
          let newEnd = newStart + clipDur;
          const snappedStart = snapToNearest(newStart);
          const snappedEnd = snapToNearest(newEnd);
          const shiftByStart = snappedStart - newStart;
          const shiftByEnd = snappedEnd - newEnd;
          const shift = Math.abs(shiftByStart) <= Math.abs(shiftByEnd) ? shiftByStart : shiftByEnd;
          if (Math.abs(shift) > 0) {
            newStart = clamp(newStart + shift, 0, Math.max(0, s.duration - clipDur));
            newEnd = newStart + clipDur;
          }
          liveRef.current = { start: newStart, end: newEnd };
          setPreview({ start: newStart, end: newEnd });
          reportGuideLines({ start: newStart, end: newEnd });
          onLiveUpdateRef.current?.(newStart);
          updateTooltip(
            ev.clientX,
            `start: ${newStart.toFixed(1)}s — end: ${newEnd.toFixed(1)}s`,
          );
          if (onMoveToRow != null) {
            const rowEl = document
              .elementFromPoint(ev.clientX, ev.clientY)
              ?.closest?.('[data-timeline-track-row]') as HTMLElement | null;
            const rowId = rowEl?.dataset?.rowId;
            if (rowId != null && rowId !== '') hoveredRowId = rowId;
          }
        } else if (s.type === 'left') {
          const maxStart = s.origEnd - MIN_CLIP_SEC;
          const rawStart = clamp(s.origStart + deltaSec, 0, maxStart);
          const newStart = clamp(snapToNearest(rawStart), 0, maxStart);
          liveRef.current = { start: newStart, end: s.origEnd };
          setPreview({ start: newStart, end: s.origEnd });
          reportGuideLines({ start: newStart, end: s.origEnd });
          onLiveUpdateRef.current?.(newStart);
          updateTooltip(ev.clientX, `start: ${newStart.toFixed(1)}s`);
        } else {
          const minEnd = s.origStart + MIN_CLIP_SEC;
          const rawEnd = clamp(s.origEnd + deltaSec, minEnd, s.duration);
          const newEnd = clamp(snapToNearest(rawEnd), minEnd, s.duration);
          liveRef.current = { start: s.origStart, end: newEnd };
          setPreview({ start: s.origStart, end: newEnd });
          reportGuideLines({ start: s.origStart, end: newEnd });
          onLiveUpdateRef.current?.(newEnd);
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
            if (
              onMoveToRow != null &&
              hoveredRowId != null &&
              hoveredRowId !== '' &&
              hoveredRowId !== currentRowId
            ) {
              onMoveToRow(hoveredRowId);
            }
          } else if (s.type === 'left') {
            onUpdateRef.current({ startTime: live.start });
          } else {
            onUpdateRef.current({ endTime: live.end });
          }
        }

        onDragGuideLinesRef.current?.(null);
        onLiveUpdateRef.current?.(null);
        setPreview(null);
        setDragType(null);
        setTooltipText(null);
        setTooltipPosition(null);
      };

      listenersRef.current = { move: onMove, up: onUp };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [currentRowId, duration, onMoveToRow, removeWindowListeners, trackLaneRef],
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
    previewRange: preview,
    tooltipText,
    tooltipPosition,
    handlers: {
      onBodyMouseDown,
      onLeftHandleMouseDown,
      onRightHandleMouseDown,
    },
  };
}
