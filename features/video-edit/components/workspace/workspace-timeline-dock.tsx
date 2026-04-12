'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTimelineClipDrag } from '@/hooks/useTimelineClipDrag';
import { useEditorStore } from '@/store/editorStore';
import { WorkspaceIconButton } from './ui';
import { WorkspaceVideoWaveform } from './workspace-video-waveform';

type Clip = {
  id: string;
  label: string;
  start: number;
  width: number;
  tone: 'violet' | 'emerald' | 'rose' | 'amber' | 'sky';
  thumbnailSrc?: string;
  verticalLane?: number;
};

const toneClass: Record<Clip['tone'], string> = {
  violet: 'bg-violet-600/90 ring-violet-400/30',
  emerald: 'bg-emerald-600/90 ring-emerald-400/25',
  rose: 'bg-rose-800/90 ring-rose-500/25',
  amber: 'bg-amber-600/90 ring-amber-400/25',
  sky: 'bg-sky-600/90 ring-sky-400/25',
};

export type WorkspaceTimelinePhase = 'no-media' | 'loading' | 'ready';

type WorkspaceTextClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
};

function WorkspaceTextTimelineClip({
  clip,
  durationSec,
  selected,
  trackLaneRef,
  onSelect,
}: WorkspaceTextClipProps) {
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateTextLayer(clip.id, patch);
    },
    [clip.id, updateTextLayer],
  );

  const {
    clipStyle,
    isDragging,
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
  });

  return (
    <>
      <div
        data-timeline-clip
        className={`absolute top-1 flex h-[calc(100%-0.5rem)] min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium text-white ring-1 ring-inset ${toneClass[clip.tone]}`}
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          border: selected ? '2px solid #5DCAA5' : 'none',
        }}
        title={clip.label}
      >
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex items-center overflow-hidden text-left leading-none select-none'
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

type WorkspaceBlurClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
};

function WorkspaceBlurTimelineClip({
  clip,
  durationSec,
  selected,
  trackLaneRef,
  onSelect,
}: WorkspaceBlurClipProps) {
  const updateBlurLayer = useEditorStore((s) => s.updateBlurLayer);
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateBlurLayer(clip.id, patch);
    },
    [clip.id, updateBlurLayer],
  );

  const {
    clipStyle,
    isDragging,
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
  });

  return (
    <>
      <div
        data-timeline-clip
        className="absolute top-1 flex h-[calc(100%-0.5rem)] min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium ring-1 ring-inset"
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          background: '#2a1a1a',
          color: '#F0997B',
          border: selected ? '2px solid #F0997B' : '0.5px solid #993C1D',
        }}
      >
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex cursor-grab items-center overflow-hidden text-left leading-none select-none active:cursor-grabbing'
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

type WorkspaceImageClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
};

function WorkspaceImageTimelineClip({
  clip,
  durationSec,
  selected,
  trackLaneRef,
  onSelect,
}: WorkspaceImageClipProps) {
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;
  const lane = clip.verticalLane ?? 0;
  const topPx = 4 + lane * 6;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateImageLayer(clip.id, patch);
    },
    [clip.id, updateImageLayer],
  );

  const {
    clipStyle,
    isDragging,
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
  });

  return (
    <>
      <div
        data-timeline-clip
        className="absolute z-5 min-w-8 touch-none overflow-hidden rounded px-1 text-[10px] font-medium ring-1 ring-inset"
        style={{
          ...clipStyle,
          top: topPx,
          bottom: 4,
          boxSizing: 'border-box',
          background: '#1a1a10',
          color: '#FAC775',
          border: selected ? '2px solid #EF9F27' : '0.5px solid #854F0B',
        }}
      >
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex min-w-0 cursor-grab items-center gap-1 overflow-hidden text-left leading-none select-none active:cursor-grabbing'
              : 'absolute inset-0 flex min-w-0 cursor-grab items-center gap-1 overflow-hidden text-left leading-none select-none active:cursor-grabbing'
          }
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            onSelect(clip.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          {clip.thumbnailSrc != null && clip.thumbnailSrc !== '' ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={clip.thumbnailSrc}
              alt=""
              className="h-4 w-4 shrink-0 rounded-sm object-cover"
              width={16}
              height={16}
            />
          ) : null}
          <span className="min-w-0 truncate">{clip.label}</span>
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

type WorkspaceVideoClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
};

function WorkspaceVideoTimelineClip({
  clip,
  durationSec,
  selected,
  trackLaneRef,
  onSelect,
}: WorkspaceVideoClipProps) {
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const updateVideoTimelineSegment = useEditorStore((s) => s.updateVideoTimelineSegment);
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateVideoTimelineSegment(clip.id, patch);
    },
    [clip.id, updateVideoTimelineSegment],
  );

  const {
    clipStyle,
    isDragging,
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
  });

  return (
    <>
      <div
        data-timeline-clip
        className="absolute top-1 bottom-1 min-h-[36px] min-w-8 overflow-hidden rounded ring-1 ring-inset ring-violet-400/50 bg-[#1e1033]"
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          border: selected ? '2px solid #5DCAA5' : undefined,
        }}
      >
        {selected && (
          <>
            <div
              className="absolute top-0 bottom-0 left-0 z-20"
              style={{
                width: 6,
                background: 'rgba(255,255,255,0.3)',
                cursor: 'col-resize',
              }}
              aria-hidden
              onMouseDown={handlers.onLeftHandleMouseDown}
            />
            <div
              className="absolute top-0 right-0 bottom-0 z-20"
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] min-h-[36px] cursor-grab select-none active:cursor-grabbing'
              : 'absolute inset-0 min-h-[36px] cursor-grab select-none active:cursor-grabbing'
          }
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            onSelect(clip.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          <WorkspaceVideoWaveform className="absolute inset-0 min-h-[36px]" />
          {Math.abs(playbackSpeed - 1) > 0.001 && (
            <span
              className="pointer-events-none absolute text-[9px] font-medium text-white"
              style={{
                background: '#534AB7',
                borderRadius: 3,
                padding: '1px 5px',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              {playbackSpeed}x
            </span>
          )}
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

type WorkspaceTimelineDockProps = {
  phase: WorkspaceTimelinePhase;
  durationSec: number;
  playheadPosition: number;
  timeDisplay: string;
  emptyLabel: string;
  loadingLabel: string;
  rulerStepSec?: number;
  tracks: { id: string; clips: Clip[] }[];
  playbackPrevLabel: string;
  playbackNextLabel: string;
  playbackPlayLabel: string;
  playbackPauseLabel: string;
  speedLabel: string;
  speedAriaLabel: string;
  speedValue: string;
  onSpeedChange: (v: string) => void;
  volumeLabel: string;
  volumeValue: number;
  onVolumeChange: (n: number) => void;
  muteLabel: string;
  unmuteLabel: string;
  fullscreenEnterLabel: string;
  fullscreenExitLabel: string;
  isFullscreen: boolean;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeekRatio?: (ratio: number) => void;
  /** Selected timeline clip id (`main-video` or a text layer id). */
  selectedTimelineClipId?: string | null;
  /** Clear timeline clip selection (empty video / text lane click). */
  onTimelineDeselect?: () => void;
  /** Select a clip (video or text) and sync the active tool in the shell. */
  onTimelineClipSelect?: (clipId: string) => void;
  /** When true, show split-at-playhead control in the transport row. */
  trimToolActive?: boolean;
  splitAtPlayheadLabel?: string;
  splitAtPlayheadAriaLabel?: string;
  onSplitAtPlayhead?: () => void;
  deleteSegmentLabel?: string;
  deleteSegmentAriaLabel?: string;
  deleteSegmentEnabled?: boolean;
  onDeleteVideoSegment?: () => void;
};

export function WorkspaceTimelineDock({
  phase,
  durationSec,
  playheadPosition,
  timeDisplay,
  emptyLabel,
  loadingLabel,
  rulerStepSec = 10,
  tracks,
  playbackPrevLabel,
  playbackNextLabel,
  playbackPlayLabel,
  playbackPauseLabel,
  speedLabel,
  speedAriaLabel,
  speedValue,
  onSpeedChange,
  volumeLabel,
  volumeValue,
  onVolumeChange,
  muteLabel,
  unmuteLabel,
  fullscreenEnterLabel,
  fullscreenExitLabel,
  isFullscreen,
  onToggleFullscreen,
  onToggleMute,
  isPlaying = false,
  onTogglePlay,
  onPrev,
  onNext,
  onSeekRatio,
  selectedTimelineClipId = null,
  onTimelineDeselect,
  onTimelineClipSelect,
  trimToolActive = false,
  splitAtPlayheadLabel = 'Split',
  splitAtPlayheadAriaLabel,
  onSplitAtPlayhead,
  deleteSegmentLabel = 'Delete clip',
  deleteSegmentAriaLabel,
  deleteSegmentEnabled = false,
  onDeleteVideoSegment,
}: WorkspaceTimelineDockProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoTrackLaneRef = useRef<HTMLDivElement>(null);
  const textTrackLaneRef = useRef<HTMLDivElement>(null);
  const blurTrackLaneRef = useRef<HTMLDivElement>(null);
  const imageTrackLaneRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const ticks: number[] = [];
  const safeDuration = Math.max(durationSec, 1e-6);
  for (let t = 0; t <= durationSec; t += rulerStepSec) {
    ticks.push(t);
  }

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el || phase !== 'ready' || !onSeekRatio || durationSec <= 0) return;
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      if (w <= 0) return;
      const x = Math.min(Math.max(clientX - rect.left, 0), w);
      onSeekRatio(x / w);
    },
    [durationSec, onSeekRatio, phase],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      seekFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [seekFromClientX]);

  const onRulerMouseDown = (e: React.MouseEvent) => {
    if (phase !== 'ready' || !onSeekRatio) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    seekFromClientX(e.clientX);
  };

  const transportDisabled = phase !== 'ready';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-white/10 bg-black/90">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/5 px-3 py-2">
        <div
          className={`flex items-center gap-1 ${transportDisabled ? 'pointer-events-none opacity-40' : ''}`}
        >
          <WorkspaceIconButton label={playbackPrevLabel} onClick={onPrev}>
            <SkipBack strokeWidth={1.75} />
          </WorkspaceIconButton>
          <WorkspaceIconButton
            label={isPlaying ? playbackPauseLabel : playbackPlayLabel}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause strokeWidth={1.75} className="fill-current" />
            ) : (
              <Play strokeWidth={1.75} className="ml-0.5 fill-current" />
            )}
          </WorkspaceIconButton>
          <WorkspaceIconButton label={playbackNextLabel} onClick={onNext}>
            <SkipForward strokeWidth={1.75} />
          </WorkspaceIconButton>
        </div>
        <span
          className={`font-mono text-xs text-muted ${transportDisabled ? 'opacity-40' : ''}`}
        >
          {timeDisplay}
        </span>
        {trimToolActive && !transportDisabled && onSplitAtPlayhead != null ? (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              aria-label={splitAtPlayheadAriaLabel ?? splitAtPlayheadLabel}
              onClick={(e) => {
                e.stopPropagation();
                onSplitAtPlayhead();
              }}
              className="rounded-md border border-amber-500/45 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100 transition-colors hover:bg-amber-500/25"
            >
              {splitAtPlayheadLabel}
            </button>
            {onDeleteVideoSegment != null ? (
              <button
                type="button"
                aria-label={deleteSegmentAriaLabel ?? deleteSegmentLabel}
                disabled={!deleteSegmentEnabled}
                title={!deleteSegmentEnabled ? deleteSegmentAriaLabel : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleteSegmentEnabled) onDeleteVideoSegment();
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-100 transition-colors hover:bg-rose-500/20 disabled:pointer-events-none disabled:opacity-35"
              >
                <Trash2 strokeWidth={1.75} className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        <label
          className={`flex items-center gap-1.5 text-xs text-muted ${transportDisabled ? 'pointer-events-none opacity-40' : ''}`}
        >
          <span className="sr-only">{speedLabel}</span>
          <select
            aria-label={speedAriaLabel}
            value={speedValue}
            onChange={(e) => onSpeedChange(e.target.value)}
            className="rounded-md border border-white/10 bg-black/50 py-1.5 pl-2 pr-7 text-xs text-foreground outline-none focus:border-violet-400/40 focus:ring-1 focus:ring-violet-400/30"
          >
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </label>
        <div
          className={`ml-auto flex min-w-32 flex-wrap items-center justify-end gap-2 sm:flex-nowrap ${transportDisabled ? 'pointer-events-none opacity-40' : ''}`}
        >
          {onToggleMute != null ? (
            <WorkspaceIconButton
              label={volumeValue === 0 ? unmuteLabel : muteLabel}
              onClick={onToggleMute}
            >
              {volumeValue === 0 ? (
                <VolumeX strokeWidth={1.75} />
              ) : (
                <Volume2 strokeWidth={1.75} />
              )}
            </WorkspaceIconButton>
          ) : null}
          <input
            type="range"
            min={0}
            max={100}
            value={volumeValue}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label={volumeLabel}
            className="h-1 w-full max-w-[120px] min-w-[72px] cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-300 [&::-webkit-slider-thumb]:bg-zinc-900"
          />
          {onToggleFullscreen != null ? (
            <WorkspaceIconButton
              label={isFullscreen ? fullscreenExitLabel : fullscreenEnterLabel}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 strokeWidth={1.75} />
              ) : (
                <Maximize2 strokeWidth={1.75} />
              )}
            </WorkspaceIconButton>
          ) : null}
        </div>
      </div>

      {phase === 'no-media' && (
        <div className="flex min-h-[120px] flex-1 items-center justify-center px-4 py-8">
          <p className="text-center text-xs text-muted">{emptyLabel}</p>
        </div>
      )}

      {phase === 'loading' && (
        <div className="flex min-h-[120px] flex-1 items-center justify-center px-4 py-8">
          <p className="text-center text-xs text-muted">{loadingLabel}</p>
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div
            ref={timelineRef}
            className="relative flex min-w-0 flex-col bg-black/25"
            role="presentation"
          >
            <div
              className="relative h-7 shrink-0 cursor-pointer border-b border-white/10 bg-black/40"
              onMouseDown={onRulerMouseDown}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  className="pointer-events-none absolute top-1 font-mono text-[10px] text-muted"
                  style={{ left: `${(t / safeDuration) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {t}s
                </span>
              ))}
            </div>

            <div className="relative flex min-h-0 flex-col">
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-violet-400"
                style={{ left: `${playheadPosition * 100}%` }}
              >
                <div className="absolute -left-1.5 top-0 h-2.5 w-3.5 rounded-sm bg-violet-400 shadow-sm ring-1 ring-violet-200/40" />
              </div>
              {tracks.map((row) => (
                <div
                  key={row.id}
                  data-timeline-track-row
                  ref={
                    row.id === 'text'
                      ? textTrackLaneRef
                      : row.id === 'video'
                        ? videoTrackLaneRef
                        : row.id === 'blur'
                          ? blurTrackLaneRef
                          : row.id === 'image'
                            ? imageTrackLaneRef
                            : undefined
                  }
                  className={
                    row.id === 'video'
                      ? 'relative h-12 min-h-12 shrink-0 border-b border-white/5 bg-black/20'
                      : 'relative h-8 shrink-0 border-b border-white/5 bg-black/20'
                  }
                  onMouseDown={
                    row.id === 'text' ||
                    row.id === 'video' ||
                    row.id === 'blur' ||
                    row.id === 'image'
                      ? (e) => {
                          if (e.target === e.currentTarget) {
                            e.stopPropagation();
                            onTimelineDeselect?.();
                          }
                        }
                      : undefined
                  }
                >
                  {row.clips.map((clip) => {
                    if (row.id === 'video' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceVideoTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          trackLaneRef={videoTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                        />
                      );
                    }
                    if (row.id === 'text' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceTextTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          trackLaneRef={textTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                        />
                      );
                    }
                    if (row.id === 'blur' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceBlurTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          trackLaneRef={blurTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                        />
                      );
                    }
                    if (row.id === 'image' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceImageTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          trackLaneRef={imageTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                        />
                      );
                    }
                    return (
                      <div
                        key={clip.id}
                        className={`pointer-events-none absolute top-1 flex h-[calc(100%-0.5rem)] min-w-8 items-center overflow-hidden rounded px-2 text-[10px] font-medium text-white ring-1 ring-inset ${toneClass[clip.tone]}`}
                        style={{
                          left: `${clip.start * 100}%`,
                          width: `${clip.width * 100}%`,
                        }}
                      >
                        <span className="truncate">{clip.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
