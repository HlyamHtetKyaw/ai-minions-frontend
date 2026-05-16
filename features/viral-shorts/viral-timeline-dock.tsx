'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useTimelineClipDrag } from '@/hooks/useTimelineClipDrag';
import { WorkspaceIconButton } from '@/features/video-edit/components/workspace/ui';
import type { BlurLayer, TextLayer } from '@/store/editorStore';

type Clip = {
  id: string;
  kind: 'video' | 'text' | 'blur';
  label: string;
  start: number;
  width: number;
  tone: 'violet' | 'emerald' | 'rose';
  verticalLane?: number;
};

const toneClass: Record<Clip['tone'], string> = {
  violet: 'bg-violet-600/90 ring-violet-400/30',
  emerald: 'bg-emerald-600/90 ring-emerald-400/25',
  rose: 'bg-rose-800/90 ring-rose-500/25',
};

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

type ViralTextClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: { startTime?: number; endTime?: number }) => void;
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
  snapPointsSec,
}: ViralTextClipProps) {
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;
  const lane = clip.verticalLane ?? 0;
  const topPx = 4 + lane * 6;

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
        className={`absolute z-5 flex min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium text-white ring-1 ring-inset ${toneClass[clip.tone]}`}
        style={{
          ...clipStyle,
          top: topPx,
          bottom: 4,
          boxSizing: 'border-box',
          border: selected ? '2px solid #5DCAA5' : 'none',
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

type ViralBlurClipProps = ViralTextClipProps;

function ViralBlurTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onUpdate,
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
        className="absolute z-5 flex min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium ring-1 ring-inset"
        style={{
          ...clipStyle,
          top: 4,
          bottom: 4,
          boxSizing: 'border-box',
          background: '#2a1a1a',
          color: '#F0997B',
          border: selected ? '2px solid #F0997B' : '0.5px solid #993C1D',
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
};

export function ViralTimelineDock({
  phase,
  durationSec,
  currentTimeSec,
  isPlaying,
  textLayers,
  blurLayers,
  selectedLayerId,
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
}: ViralTimelineDockProps) {
  const timelineSeekRef = useRef<HTMLDivElement>(null);
  const videoTrackLaneRef = useRef<HTMLDivElement>(null);
  const textTrackLaneRef = useRef<HTMLDivElement>(null);
  const blurTrackLaneRef = useRef<HTMLDivElement>(null);
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
    }));
    return [
      { id: 'video', clips: videoClips },
      { id: 'text', clips: textClips },
      { id: 'blur', clips: blurClips },
    ];
  }, [blurLayers, durationSec, textLayers, textLaneById, videoLabel]);

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

  const transportDisabled = phase !== 'ready';

  return (
    <div className="flex h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-card-border bg-card/95">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-card-border px-2 py-2 sm:gap-3 sm:px-3">
        <div
          className={`flex items-center gap-1 ${transportDisabled ? 'pointer-events-none opacity-40' : ''}`}
        >
          <WorkspaceIconButton label={prevLabel} onClick={() => onSeekBy(-5)}>
            <SkipBack strokeWidth={1.75} />
          </WorkspaceIconButton>
          <WorkspaceIconButton
            label={isPlaying ? pauseLabel : playLabel}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause strokeWidth={1.75} className="fill-current" />
            ) : (
              <Play strokeWidth={1.75} className="ml-0.5 fill-current" />
            )}
          </WorkspaceIconButton>
          <WorkspaceIconButton label={nextLabel} onClick={() => onSeekBy(5)}>
            <SkipForward strokeWidth={1.75} />
          </WorkspaceIconButton>
        </div>
        <span
          className={`font-mono text-xs text-muted-foreground ${transportDisabled ? 'opacity-40' : ''}`}
        >
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
        <div className="scrollbar-themed flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto bg-background/50">
          <div className="relative flex min-w-[560px] flex-col">
            <div
              ref={timelineSeekRef}
              className="relative ml-0 mr-0 flex min-h-0 w-full flex-col"
              role="presentation"
            >
              <div
                className="relative h-8 shrink-0 cursor-grab touch-none border-b border-card-border bg-subtle/30 active:cursor-grabbing"
                onPointerDown={onScrubPointerDown}
                onPointerMove={onScrubPointerMove}
                onPointerUp={onScrubPointerUpOrCancel}
                onPointerCancel={onScrubPointerUpOrCancel}
              >
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="pointer-events-none absolute top-1 font-mono text-[10px] text-muted-foreground"
                    style={{ left: `${(t / safeDuration) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    {Math.round(t)}s
                  </span>
                ))}
              </div>

              <div className="relative flex min-h-0 flex-col">
                {tracks.map((row) => {
                  const rowClipEdgesSec = row.clips.flatMap((item) => [
                    item.start * durationSec,
                    (item.start + item.width) * durationSec,
                  ]);
                  return (
                    <div
                      key={row.id}
                      data-timeline-track-row
                      data-row-id={row.id}
                      ref={
                        row.id === 'text'
                          ? textTrackLaneRef
                          : row.id === 'video'
                            ? videoTrackLaneRef
                            : row.id === 'blur'
                              ? blurTrackLaneRef
                              : undefined
                      }
                      className={
                        row.id === 'video'
                          ? 'relative h-11 min-h-11 shrink-0 border-b border-card-border bg-card/30'
                          : 'relative h-8 shrink-0 border-b border-card-border bg-card/20'
                      }
                      onMouseDown={
                        row.id === 'video' || row.id === 'text' || row.id === 'blur'
                          ? (e) => {
                              if (e.target === e.currentTarget) {
                                e.stopPropagation();
                                onDeselect();
                              }
                            }
                          : undefined
                      }
                    >
                      {row.clips.map((clip) => {
                        const clipStartSec = clip.start * durationSec;
                        const clipEndSec = (clip.start + clip.width) * durationSec;
                        const snapPointsSec = [
                          ...rowClipEdgesSec.filter(
                            (value) =>
                              Math.abs(value - clipStartSec) > 1e-4 &&
                              Math.abs(value - clipEndSec) > 1e-4,
                          ),
                          currentTimeSec,
                        ].filter((value) => Number.isFinite(value));

                        if (clip.kind === 'video') {
                          return (
                            <div
                              key={clip.id}
                              data-timeline-clip
                              className="pointer-events-none absolute top-1 bottom-1 min-h-[36px] min-w-8 overflow-hidden rounded bg-[#1e1033] ring-1 ring-inset ring-violet-400/50"
                              style={{
                                left: `${clip.start * 100}%`,
                                width: `${clip.width * 100}%`,
                                boxSizing: 'border-box',
                              }}
                              title={clip.label}
                            >
                              <span className="pointer-events-none flex h-full items-center px-2 text-[10px] font-medium text-white/90">
                                {clip.label}
                              </span>
                            </div>
                          );
                        }
                        if (clip.kind === 'text') {
                          return (
                            <ViralTextTimelineClip
                              key={clip.id}
                              clip={clip}
                              durationSec={durationSec}
                              selected={clip.id === selectedLayerId}
                              rowId={row.id}
                              trackLaneRef={textTrackLaneRef}
                              onSelect={onSelectClip}
                              onUpdate={onUpdateTextTiming}
                              snapPointsSec={snapPointsSec}
                            />
                          );
                        }
                        if (clip.kind === 'blur') {
                          return (
                            <ViralBlurTimelineClip
                              key={clip.id}
                              clip={clip}
                              durationSec={durationSec}
                              selected={clip.id === selectedLayerId}
                              rowId={row.id}
                              trackLaneRef={blurTrackLaneRef}
                              onSelect={onSelectClip}
                              onUpdate={onUpdateBlurTiming}
                              snapPointsSec={snapPointsSec}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })}
              </div>

              <div
                className="pointer-events-none absolute bottom-0 top-0 z-[11] w-px bg-[#7c5cff]"
                style={{ left: `${playheadRatio * 100}%` }}
              >
                <div className="absolute -left-2 top-0 h-3 w-4 rounded-sm bg-[#7c5cff] shadow-sm ring-1 ring-violet-200/40" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
