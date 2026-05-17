'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useTimelineClipDrag } from '@/hooks/useTimelineClipDrag';
import { WorkspaceIconButton } from '@/features/video-edit/components/workspace/ui';
import type { BlurLayer, TextLayer } from '@/store/editorStore';
import type { LayerOrderEntry } from './viral-overlay-store';

type Clip = {
  id: string;
  kind: 'video' | 'text' | 'blur' | 'subtitle';
  label: string;
  start: number;
  width: number;
  tone: 'violet' | 'emerald' | 'rose' | 'amber';
  verticalLane?: number;
};

const toneClass: Record<Clip['tone'], string> = {
  violet: 'bg-violet-600/95 ring-violet-400/40 dark:bg-violet-500/90 dark:ring-violet-300/35',
  emerald: 'bg-emerald-600/95 ring-emerald-400/35 dark:bg-emerald-500/90',
  rose: 'bg-rose-600/95 ring-rose-400/35 dark:bg-rose-500/90',
  amber: 'bg-amber-500/95 text-zinc-950 ring-amber-400/45 dark:bg-amber-400/90 dark:text-white dark:ring-amber-300/40',
};

const TRACK_ROW_VIDEO_CLASS =
  'viral-timeline-track relative h-12 min-h-12 shrink-0 border-b border-violet-200/40 bg-white dark:border-white/5 dark:bg-black/20';
const TRACK_ROW_LANE_CLASS =
  'viral-timeline-track relative h-8 shrink-0 border-b border-violet-200/40 bg-white dark:border-white/5 dark:bg-black/20';
const TRACK_ROW_EMPTY_CLASS =
  'viral-timeline-track-empty relative h-8 shrink-0 border-b border-violet-100/40 bg-white dark:border-white/[0.04] dark:bg-white/[0.02]';

type TimelineLaneItem = { id: string; startTime: number; endTime: number };

function assignVerticalLane(items: TimelineLaneItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id),
  );
  const laneEnd: number[] = [];
  const map = new Map<string, number>();
  for (const l of sorted) {
    let lane = 0;
    while (lane < laneEnd.length && laneEnd[lane]! > l.startTime + 1e-4) {
      lane += 1;
    }
    if (lane === laneEnd.length) {
      laneEnd.push(l.endTime);
    } else {
      laneEnd[lane] = Math.max(laneEnd[lane]!, l.endTime);
    }
    map.set(l.id, lane);
  }
  return map;
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export type ViralTimelinePhase = 'loading' | 'ready';

export type SrtCueForTimeline = {
  id: string;
  content: string;
  startTime: number; // seconds
  endTime: number;   // seconds
};

type ViralTextClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  onMoveToRow?: (targetRowId: string) => void;
  snapPointsSec?: number[];
};

function ViralTextTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onUpdate,
  onMoveToRow,
  snapPointsSec,
}: ViralTextClipProps) {
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      onUpdate(clip.id, patch);
    },
    [clip.id, onUpdate],
  );

  const {
    clipStyle,
    isDragging,
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow,
    snapPointsSec,
  });
  const ghostLeftPct =
    durationSec > 0 && previewRange != null && dragType === 'left'
      ? Math.max(0, ((previewRange.start - startTime) / durationSec) * 100)
      : 0;
  const ghostRightPct =
    durationSec > 0 && previewRange != null && dragType === 'right'
      ? Math.max(0, ((endTime - previewRange.end) / durationSec) * 100)
      : 0;

  return (
    <>
      <div
        data-timeline-clip
        className={`absolute z-5 flex min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium text-white ring-1 ring-inset ${toneClass[clip.tone]}`}
        style={{
          ...clipStyle,
          top: 4,
          bottom: 4,
          boxSizing: 'border-box',
          border: selected ? '2px solid rgb(196 181 253)' : 'none',
        }}
        title={clip.label}
      >
        {ghostLeftPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-black/35"
            style={{ width: `${Math.min(100, ghostLeftPct)}%` }}
            aria-hidden
          />
        ) : null}
        {ghostRightPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 bg-black/35"
            style={{ width: `${Math.min(100, ghostRightPct)}%` }}
            aria-hidden
          />
        ) : null}
        {selected && (
          <>
            <div
              className="absolute top-0 bottom-0 left-0 z-10"
              style={{
                width: 6,
                background: 'rgba(255,255,255,0.3)',
                cursor: 'col-resize',
              }}
              aria-hidden
              onMouseDown={handlers.onLeftHandleMouseDown}
            />
            <div
              className="absolute top-0 right-0 bottom-0 z-10"
              style={{
                width: 6,
                background: 'rgba(255,255,255,0.3)',
                cursor: 'col-resize',
              }}
              aria-hidden
              onMouseDown={handlers.onRightHandleMouseDown}
            />
          </>
        )}
        <div
          className={
            selected
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex cursor-grab items-center overflow-hidden text-left leading-none select-none'
              : 'absolute inset-0 flex cursor-grab items-center overflow-hidden text-left leading-none select-none active:cursor-grabbing'
          }
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            onSelect(clip.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          <span className="truncate">{clip.label}</span>
        </div>
      </div>
      {tooltipText != null && tooltipPosition != null && (
        <div
          className="pointer-events-none fixed z-100 whitespace-nowrap"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, calc(-100% - 4px))',
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: 10,
            borderRadius: 4,
            padding: '3px 7px',
          }}
        >
          {tooltipText}
        </div>
      )}
    </>
  );
}

type SrtCueClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  snapPointsSec?: number[];
};

function SrtCueTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onUpdate,
  snapPointsSec,
}: SrtCueClipProps) {
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      onUpdate(clip.id, patch);
    },
    [clip.id, onUpdate],
  );

  const {
    clipStyle,
    isDragging,
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    snapPointsSec,
  });

  const ghostLeftPct =
    durationSec > 0 && previewRange != null && dragType === 'left'
      ? Math.max(0, ((previewRange.start - startTime) / durationSec) * 100)
      : 0;
  const ghostRightPct =
    durationSec > 0 && previewRange != null && dragType === 'right'
      ? Math.max(0, ((endTime - previewRange.end) / durationSec) * 100)
      : 0;

  return (
    <>
      <div
        data-timeline-clip
        className={`absolute z-5 flex min-w-[6px] touch-none items-center overflow-hidden rounded px-1 text-[9px] font-semibold text-white ring-1 ring-inset ${selected
            ? 'border-2 border-amber-200 bg-amber-500 ring-amber-200/80 dark:border-amber-100 dark:bg-amber-400 dark:ring-amber-100/60'
            : 'border border-transparent bg-amber-500/95 ring-amber-400/35 dark:bg-amber-500/88 dark:ring-amber-300/30'
          }`}
        style={{
          ...clipStyle,
          top: 4,
          bottom: 4,
          boxSizing: 'border-box',
        }}
        title={clip.label}
      >
        {ghostLeftPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-black/35"
            style={{ width: `${Math.min(100, ghostLeftPct)}%` }}
            aria-hidden
          />
        ) : null}
        {ghostRightPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 bg-black/35"
            style={{ width: `${Math.min(100, ghostRightPct)}%` }}
            aria-hidden
          />
        ) : null}
        {selected && (
          <>
            <div
              className="absolute top-0 bottom-0 left-0 z-10"
              style={{ width: 6, background: 'rgba(255,255,255,0.35)', cursor: 'col-resize' }}
              aria-hidden
              onMouseDown={handlers.onLeftHandleMouseDown}
            />
            <div
              className="absolute top-0 right-0 bottom-0 z-10"
              style={{ width: 6, background: 'rgba(255,255,255,0.35)', cursor: 'col-resize' }}
              aria-hidden
              onMouseDown={handlers.onRightHandleMouseDown}
            />
          </>
        )}
        <div
          className={
            selected
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex cursor-grab items-center overflow-hidden text-left leading-none select-none'
              : 'absolute inset-0 flex cursor-grab items-center overflow-hidden px-1 text-left leading-none select-none active:cursor-grabbing'
          }
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            onSelect(clip.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          <span className="truncate">{clip.label}</span>
        </div>
      </div>
      {tooltipText != null && tooltipPosition != null && (
        <div
          className="pointer-events-none fixed z-100 whitespace-nowrap"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, calc(-100% - 4px))',
            background: 'rgb(24 24 27)',
            color: 'rgb(251 191 36)',
            fontSize: 10,
            borderRadius: 4,
            padding: '3px 7px',
          }}
        >
          {tooltipText}
        </div>
      )}
    </>
  );
}


type ViralBlurClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  onMoveToRow?: (targetRowId: string) => void;
  snapPointsSec?: number[];
};

function ViralBlurTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onUpdate,
  onMoveToRow,
  snapPointsSec,
}: ViralBlurClipProps) {
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      onUpdate(clip.id, patch);
    },
    [clip.id, onUpdate],
  );

  const {
    clipStyle,
    isDragging,
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow,
    snapPointsSec,
  });
  const ghostLeftPct =
    durationSec > 0 && previewRange != null && dragType === 'left'
      ? Math.max(0, ((previewRange.start - startTime) / durationSec) * 100)
      : 0;
  const ghostRightPct =
    durationSec > 0 && previewRange != null && dragType === 'right'
      ? Math.max(0, ((endTime - previewRange.end) / durationSec) * 100)
      : 0;

  return (
    <>
      <div
        data-timeline-clip
        className={`absolute z-5 flex min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium ring-1 ring-inset text-zinc-100 dark:text-rose-100 ${selected
            ? 'border-2 border-violet-300 bg-zinc-600 ring-violet-400/50 dark:border-violet-300 dark:bg-zinc-700 dark:ring-violet-400/40'
            : 'border border-transparent bg-zinc-500/90 ring-zinc-400/30 dark:bg-zinc-700/90 dark:ring-zinc-500/35'
          }`}
        style={{
          ...clipStyle,
          top: 4,
          bottom: 4,
          boxSizing: 'border-box',
        }}
        title={clip.label}
      >
        {ghostLeftPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-black/35"
            style={{ width: `${Math.min(100, ghostLeftPct)}%` }}
            aria-hidden
          />
        ) : null}
        {ghostRightPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 bg-black/35"
            style={{ width: `${Math.min(100, ghostRightPct)}%` }}
            aria-hidden
          />
        ) : null}
        {selected && (
          <>
            <div
              className="absolute top-0 bottom-0 left-0 z-10"
              style={{
                width: 6,
                background: 'rgba(255,255,255,0.3)',
                cursor: 'col-resize',
              }}
              aria-hidden
              onMouseDown={handlers.onLeftHandleMouseDown}
            />
            <div
              className="absolute top-0 right-0 bottom-0 z-10"
              style={{
                width: 6,
                background: 'rgba(255,255,255,0.3)',
                cursor: 'col-resize',
              }}
              aria-hidden
              onMouseDown={handlers.onRightHandleMouseDown}
            />
          </>
        )}
        <div
          className={
            selected
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex cursor-grab items-center overflow-hidden text-left leading-none select-none'
              : 'absolute inset-0 flex cursor-grab items-center overflow-hidden text-left leading-none select-none active:cursor-grabbing'
          }
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            onSelect(clip.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          <span className="truncate">Blur</span>
        </div>
      </div>
      {tooltipText != null && tooltipPosition != null && (
        <div
          className="pointer-events-none fixed z-100 whitespace-nowrap"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, calc(-100% - 4px))',
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: 10,
            borderRadius: 4,
            padding: '3px 7px',
          }}
        >
          {tooltipText}
        </div>
      )}
    </>
  );
}

export type ViralTimelineDockProps = {
  phase: ViralTimelinePhase;
  durationSec: number;
  currentTimeSec: number;
  isPlaying: boolean;
  textLayers: TextLayer[];
  blurLayers: BlurLayer[];
  selectedLayerId: string | null;
  /** SRT subtitle cues to display as a draggable timeline track (optional). */
  srtCues?: SrtCueForTimeline[];
  /** ID of the currently-selected SRT cue (optional). */
  selectedSrtCueId?: string | null;
  /**
   * Unified layer order from the overlay store.
   * Index 0 = bottom-most z, last = top-most z.
   * Used to sort text/blur track rows so top row = highest z (CapCut style).
   */
  layerOrder?: LayerOrderEntry[];
  /** Called when user clicks ↑ on a track row to move it higher. */
  onMoveLayerUp?: (id: string) => void;
  /** Called when user clicks ↓ on a track row to move it lower. */
  onMoveLayerDown?: (id: string) => void;
  videoLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  playLabel: string;
  pauseLabel: string;
  prevLabel: string;
  nextLabel: string;
  onTogglePlay: () => void;
  onSeekBy: (deltaSec: number) => void;
  onSeekRatio: (ratio: number) => void;
  onSelectClip: (id: string) => void;
  onDeselect: () => void;
  onUpdateTextTiming: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  onUpdateBlurTiming: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  /** Called when an SRT cue clip is dragged/resized. */
  onUpdateSrtCueTiming?: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  /** Called when an SRT cue clip is clicked — use to select+scroll to that cue. */
  onSelectSrtCue?: (id: string) => void;
};

export function ViralTimelineDock({
  phase,
  durationSec,
  currentTimeSec,
  isPlaying,
  textLayers,
  blurLayers,
  selectedLayerId,
  srtCues,
  selectedSrtCueId,
  layerOrder,
  onMoveLayerUp,
  onMoveLayerDown,
  videoLabel,
  emptyLabel,
  loadingLabel,
  playLabel,
  pauseLabel,
  prevLabel,
  nextLabel,
  onTogglePlay,
  onSeekBy,
  onSeekRatio,
  onSelectClip,
  onDeselect,
  onUpdateTextTiming,
  onUpdateBlurTiming,
  onUpdateSrtCueTiming,
  onSelectSrtCue,
}: ViralTimelineDockProps) {
  const timelineSeekRef = useRef<HTMLDivElement>(null);
  const videoTrackLaneRef = useRef<HTMLDivElement>(null);
  const textTrackLaneRef = useRef<HTMLDivElement>(null);
  const blurTrackLaneRef = useRef<HTMLDivElement>(null);
  const srtTrackLaneRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const scrubPointerIdRef = useRef<number | null>(null);

  const safeDuration = Math.max(durationSec, 1e-6);
  const playheadRatio = phase === 'ready' && safeDuration > 0 ? currentTimeSec / safeDuration : 0;

  const textLaneById = useMemo(
    () =>
      assignVerticalLane(
        textLayers.map((l) => ({ id: l.id, startTime: l.startTime, endTime: l.endTime })),
      ),
    [textLayers],
  );

  const blurLaneById = useMemo(
    () =>
      assignVerticalLane(
        blurLayers.map((l) => ({ id: l.id, startTime: l.startTime, endTime: l.endTime })),
      ),
    [blurLayers],
  );

  const maxBlurLane = useMemo(
    () => (blurLayers.length === 0 ? 0 : Math.max(...blurLayers.map((l) => blurLaneById.get(l.id) ?? 0))),
    [blurLayers, blurLaneById],
  );

  const tracks = useMemo(() => {
    const d = Math.max(durationSec, 1e-6);
    const videoClips: Clip[] = [
      {
        id: 'viral-base-video',
        kind: 'video',
        label: videoLabel,
        start: 0,
        width: 1,
        tone: 'violet',
      },
    ];
    const textClips: Clip[] = textLayers.map((l) => ({
      id: l.id,
      kind: 'text' as const,
      label: (l.content.trim() || 'Text').slice(0, 32),
      start: l.startTime / d,
      width: Math.max((l.endTime - l.startTime) / d, 0.004),
      tone: 'emerald' as const,
      verticalLane: textLaneById.get(l.id) ?? 0,
    }));
    const blurClips: Clip[] = blurLayers.map((l) => ({
      id: l.id,
      kind: 'blur' as const,
      label: 'Blur',
      start: l.startTime / d,
      width: Math.max((l.endTime - l.startTime) / d, 0.004),
      tone: 'rose' as const,
      verticalLane: blurLaneById.get(l.id) ?? 0,
    }));
    const subtitleClips: Clip[] = (srtCues ?? []).map((c) => ({
      id: c.id,
      kind: 'subtitle' as const,
      label: (c.content.trim() || 'Subtitle').slice(0, 40),
      start: c.startTime / d,
      width: Math.max((c.endTime - c.startTime) / d, 0.002),
      tone: 'amber' as const,
    }));

    // Build ordered text+blur rows: highest z-order entry = first row displayed (CapCut: top row = on top).
    // layerOrder index 0 = bottom-most → we reverse so the last entry (top z) is the first row.
    const orderedLayerRows: Array<{ id: string; rowId: string; type: 'text' | 'blur'; clips: Clip[] }> = [];
    if (layerOrder && layerOrder.length > 0) {
      // Reverse so highest z is first (top of timeline)
      const reversed = [...layerOrder].reverse();
      for (const entry of reversed) {
        if (entry.type === 'text') {
          const l = textLayers.find((x) => x.id === entry.id);
          if (!l) continue;
          const clip: Clip = {
            id: l.id,
            kind: 'text',
            label: (l.content.trim() || 'Text').slice(0, 32),
            start: l.startTime / d,
            width: Math.max((l.endTime - l.startTime) / d, 0.004),
            tone: 'emerald',
            verticalLane: 0,
          };
          orderedLayerRows.push({ id: entry.id, rowId: `text-${entry.id}`, type: 'text', clips: [clip] });
        } else {
          const l = blurLayers.find((x) => x.id === entry.id);
          if (!l) continue;
          const clip: Clip = {
            id: l.id,
            kind: 'blur',
            label: 'Blur',
            start: l.startTime / d,
            width: Math.max((l.endTime - l.startTime) / d, 0.004),
            tone: 'rose',
            verticalLane: 0,
          };
          orderedLayerRows.push({ id: entry.id, rowId: `blur-${entry.id}`, type: 'blur', clips: [clip] });
        }
      }
    } else {
      // Fallback: no layerOrder — show text clips grouped then blur clips grouped
      for (const l of textLayers) {
        const clip: Clip = {
          id: l.id, kind: 'text', label: (l.content.trim() || 'Text').slice(0, 32),
          start: l.startTime / d, width: Math.max((l.endTime - l.startTime) / d, 0.004),
          tone: 'emerald', verticalLane: textLaneById.get(l.id) ?? 0,
        };
        orderedLayerRows.push({ id: l.id, rowId: `text-${l.id}`, type: 'text', clips: [clip] });
      }
      for (const l of blurLayers) {
        const clip: Clip = {
          id: l.id, kind: 'blur', label: 'Blur',
          start: l.startTime / d, width: Math.max((l.endTime - l.startTime) / d, 0.004),
          tone: 'rose', verticalLane: blurLaneById.get(l.id) ?? 0,
        };
        orderedLayerRows.push({ id: l.id, rowId: `blur-${l.id}`, type: 'blur', clips: [clip] });
      }
    }

    return [
      { id: 'video', clips: videoClips, layerRows: null },
      { id: 'subtitle', clips: subtitleClips, layerRows: null },
      { id: '__ordered__', clips: [], layerRows: orderedLayerRows },
    ];
  }, [blurLayers, durationSec, textLayers, textLaneById, blurLaneById, videoLabel, srtCues, layerOrder]);

  const rulerStepSec = 10;
  const ticks: number[] = [];
  for (let t = 0; t <= durationSec; t += rulerStepSec) {
    ticks.push(t);
  }
  const lastTick = ticks[ticks.length - 1];
  if (lastTick == null || Math.abs(lastTick - durationSec) > 1e-6) {
    ticks.push(durationSec);
  }

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = timelineSeekRef.current;
      if (!el || phase !== 'ready' || !onSeekRatio || durationSec <= 0) return;
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      if (w <= 0) return;
      const x = Math.min(Math.max(clientX - rect.left, 0), w);
      onSeekRatio(x / w);
    },
    [durationSec, onSeekRatio, phase],
  );

  const onScrubPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (phase !== 'ready' || !onSeekRatio || durationSec <= 0) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    scrubPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const onScrubPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current || scrubPointerIdRef.current !== e.pointerId) return;
    seekFromClientX(e.clientX);
  };

  const onScrubPointerUpOrCancel = (e: React.PointerEvent<HTMLElement>) => {
    if (scrubPointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    scrubPointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
  };

  // onMoveToRow handler: when a clip is dragged to a different row,
  // compute the reorder direction and call onMoveLayerUp/Down.
  const handleClipMoveToRow = useCallback(
    (clipId: string, targetRowId: string, currentRowId: string) => {
      const orderedRows = tracks.find((t) => t.id === '__ordered__')?.layerRows ?? [];
      const orderedIds = orderedRows.map((r) => r.rowId);
      const fromIdx = orderedIds.indexOf(currentRowId);
      const toIdx = orderedIds.indexOf(targetRowId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const times = Math.abs(toIdx - fromIdx);
      if (toIdx < fromIdx) {
        for (let i = 0; i < times; i++) onMoveLayerUp?.(clipId);
      } else {
        for (let i = 0; i < times; i++) onMoveLayerDown?.(clipId);
      }
    },
    [tracks, onMoveLayerUp, onMoveLayerDown],
  );

  const transportDisabled = phase !== 'ready';
  return (
    <div className="viral-timeline-dock flex h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <div className="viral-timeline-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-violet-200/50 bg-white px-2 py-2 sm:gap-3 sm:px-3 dark:border-violet-500/15 dark:bg-zinc-900/80">
        <div className={`flex items-center gap-1 ${transportDisabled ? 'pointer-events-none opacity-40' : ''}`}>
          <WorkspaceIconButton
            className="viral-timeline-transport-btn"
            label={prevLabel}
            onClick={() => onSeekBy(-5)}
          >
            <SkipBack strokeWidth={1.75} />
          </WorkspaceIconButton>
          <WorkspaceIconButton
            className="viral-timeline-transport-btn"
            label={isPlaying ? pauseLabel : playLabel}
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause strokeWidth={1.75} className="fill-current" /> : <Play strokeWidth={1.75} className="ml-0.5 fill-current" />}
          </WorkspaceIconButton>
          <WorkspaceIconButton
            className="viral-timeline-transport-btn"
            label={nextLabel}
            onClick={() => onSeekBy(5)}
          >
            <SkipForward strokeWidth={1.75} />
          </WorkspaceIconButton>
        </div>
        <span className={`font-mono text-xs text-muted-foreground ${transportDisabled ? 'opacity-40' : ''}`}>
          {formatClock(currentTimeSec)} / {formatClock(durationSec)}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex min-h-[100px] flex-1 items-center justify-center px-4 py-6">
          <p className="text-center text-xs text-muted-foreground">{loadingLabel}</p>
        </div>
      )}

      {phase === 'ready' && durationSec <= 0 && (
        <div className="flex min-h-[100px] flex-1 items-center justify-center px-4 py-6">
          <p className="text-center text-xs text-muted-foreground">{emptyLabel}</p>
        </div>
      )}

      {phase === 'ready' && durationSec > 0 && (
        <div className="viral-timeline-canvas scrollbar-themed flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto bg-white dark:bg-zinc-950">
          <div className="relative flex min-w-[560px] flex-col bg-white dark:bg-black/25">
            {/* Ruler */}
            <div
              ref={timelineSeekRef}
              className="viral-timeline-ruler relative h-7 shrink-0 cursor-grab touch-none border-b border-violet-200/50 bg-white active:cursor-grabbing dark:border-violet-500/15 dark:bg-black/40"
              onPointerDown={onScrubPointerDown}
              onPointerMove={onScrubPointerMove}
              onPointerUp={onScrubPointerUpOrCancel}
              onPointerCancel={onScrubPointerUpOrCancel}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  className="pointer-events-none absolute top-1 font-mono text-[10px] text-muted-foreground/70"
                  style={{ left: `${(t / safeDuration) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {Math.round(t)}s
                </span>
              ))}
            </div>

            {/* Track rows */}
            <div className="relative flex min-h-0 flex-col">
              {tracks.map((row) => {
                // ── Video ──
                if (row.id === 'video') {
                  const vc = row.clips[0];
                  if (!vc) return null;
                  return (
                    <div
                      key="video"
                      data-timeline-track-row
                      data-row-id="video"
                      ref={videoTrackLaneRef}
                      className={TRACK_ROW_VIDEO_CLASS}
                      onMouseDown={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); onDeselect(); } }}
                    >
                      <div
                        className="pointer-events-none absolute top-1 bottom-1 min-w-8 overflow-hidden rounded bg-gradient-to-r from-violet-700 to-indigo-800 ring-1 ring-inset ring-violet-400/45 dark:from-violet-600 dark:to-indigo-950"
                        style={{ left: `${vc.start * 100}%`, width: `${vc.width * 100}%` }}
                      >
                        <span className="flex h-full items-center px-2.5 text-[10px] font-semibold text-white">{vc.label}</span>
                      </div>
                    </div>
                  );
                }

                // ── SRT ──
                if (row.id === 'subtitle' && (srtCues ?? []).length > 0) {
                  return (
                    <div
                      key="subtitle"
                      data-timeline-track-row
                      data-row-id="subtitle"
                      ref={srtTrackLaneRef}
                      className={TRACK_ROW_LANE_CLASS}
                      onMouseDown={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); onDeselect(); } }}
                    >
                      {row.clips.map((clip) => (
                        <SrtCueTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedSrtCueId}
                          rowId="subtitle"
                          trackLaneRef={srtTrackLaneRef}
                          onSelect={(id) => {
                            onSelectSrtCue?.(id);
                            const cue = (srtCues ?? []).find((c) => c.id === id);
                            if (cue && cue.startTime >= 0) onSeekRatio(cue.startTime / Math.max(durationSec, 1e-6));
                          }}
                          onUpdate={(id, patch) => onUpdateSrtCueTiming?.(id, patch)}
                          snapPointsSec={[currentTimeSec].filter(Number.isFinite)}
                        />
                      ))}
                    </div>
                  );
                }

                // ── Ordered text + blur rows ──
                if (row.id === '__ordered__' && row.layerRows) {
                  const layerRowIds = row.layerRows.map((r) => r.rowId);
                  return row.layerRows.map((lr) => {
                    const isText = lr.type === 'text';
                    const clip = lr.clips[0];
                    if (!clip) return null;

                    const trackRef = isText ? textTrackLaneRef : blurTrackLaneRef;
                    return (
                      <div
                        key={lr.rowId}
                        data-timeline-track-row
                        data-row-id={lr.rowId}
                        className={TRACK_ROW_LANE_CLASS}
                        onMouseDown={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); onDeselect(); } }}
                      >
                        <div ref={trackRef} className="absolute inset-0">
                          {clip.kind === 'text' ? (
                            <ViralTextTimelineClip
                              clip={clip}
                              durationSec={durationSec}
                              selected={clip.id === selectedLayerId}
                              rowId={lr.rowId}
                              trackLaneRef={trackRef}
                              onSelect={onSelectClip}
                              onUpdate={onUpdateTextTiming}
                              onMoveToRow={(targetRowId) => handleClipMoveToRow(clip.id, targetRowId, lr.rowId)}
                              snapPointsSec={[currentTimeSec]}
                            />
                          ) : (
                            <ViralBlurTimelineClip
                              clip={clip}
                              durationSec={durationSec}
                              selected={clip.id === selectedLayerId}
                              rowId={lr.rowId}
                              trackLaneRef={trackRef}
                              onSelect={onSelectClip}
                              onUpdate={onUpdateBlurTiming}
                              onMoveToRow={(targetRowId) => handleClipMoveToRow(clip.id, targetRowId, lr.rowId)}
                              snapPointsSec={[currentTimeSec]}
                            />
                          )}
                        </div>
                      </div>
                    );
                  });
                }
                return null;
              })}

              {/* 4 extra empty lanes */}
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={`empty-lane-${n}`}
                  className={TRACK_ROW_EMPTY_CLASS}
                />
              ))}
            </div>

            {/* Playhead */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-[11] w-px bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.55)] dark:bg-violet-400"
              style={{ left: `${playheadRatio * 100}%` }}
            >
              <div className="absolute -left-1.5 top-0 h-2.5 w-3.5 rounded-sm bg-violet-500 shadow-sm ring-1 ring-violet-300/50 dark:bg-violet-400 dark:ring-violet-200/30" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
