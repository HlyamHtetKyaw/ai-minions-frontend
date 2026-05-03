'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
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
import {
  useTimelineClipDrag,
  type UseTimelineClipDragParams,
} from '@/hooks/useTimelineClipDrag';
import { useEditorStore } from '@/store/editorStore';
import { WorkspaceIconButton } from './ui';
import { WorkspaceVideoWaveform } from './workspace-video-waveform';

type Clip = {
  id: string;
  kind: 'video' | 'text' | 'blur' | 'image' | 'audio';
  label: string;
  start: number;
  width: number;
  tone: 'violet' | 'emerald' | 'rose' | 'amber' | 'sky';
  thumbnailSrc?: string;
  verticalLane?: number;
  audioType?: 'music' | 'voiceover';
};

const toneClass: Record<Clip['tone'], string> = {
  violet: 'bg-violet-600/90 ring-violet-400/30',
  emerald: 'bg-emerald-600/90 ring-emerald-400/25',
  rose: 'bg-rose-800/90 ring-rose-500/25',
  amber: 'bg-amber-600/90 ring-amber-400/25',
  sky: 'bg-sky-600/90 ring-sky-400/25',
};

const WorkspaceTimelineDragGuideContext = createContext<
  ((ratios: number[] | null) => void) | null
>(null);

function useWorkspaceTimelineClipDrag(
  params: Omit<UseTimelineClipDragParams, 'onDragGuideLines'>,
) {
  const setGuide = useContext(WorkspaceTimelineDragGuideContext);
  return useTimelineClipDrag({
    ...params,
    onDragGuideLines: setGuide ?? undefined,
  });
}

export type WorkspaceTimelinePhase = 'no-media' | 'loading' | 'ready';

type WorkspaceTextClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMoveToRow?: (clipId: string, rowId: string) => void;
  snapPointsSec?: number[];
  onTrimHoverTimeChange?: (timeSec: number | null) => void;
};

function WorkspaceTextTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onMoveToRow,
  snapPointsSec,
  onTrimHoverTimeChange,
}: WorkspaceTextClipProps) {
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;
  const lane = clip.verticalLane ?? 0;
  const topPx = 4 + lane * 6;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateTextLayer(clip.id, patch);
    },
    [clip.id, updateTextLayer],
  );

  const {
    clipStyle,
    isDragging,
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useWorkspaceTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow: onMoveToRow ? (targetRowId) => onMoveToRow(clip.id, targetRowId) : undefined,
    onLiveUpdate: onTrimHoverTimeChange,
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
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMoveToRow?: (clipId: string, rowId: string) => void;
  snapPointsSec?: number[];
  onTrimHoverTimeChange?: (timeSec: number | null) => void;
};

function WorkspaceBlurTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onMoveToRow,
  snapPointsSec,
  onTrimHoverTimeChange,
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
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useWorkspaceTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow: onMoveToRow ? (targetRowId) => onMoveToRow(clip.id, targetRowId) : undefined,
    onLiveUpdate: onTrimHoverTimeChange,
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
        className="absolute top-1 flex h-[calc(100%-0.5rem)] min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium ring-1 ring-inset"
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          background: '#2a1a1a',
          color: '#F0997B',
          border: selected ? '2px solid #F0997B' : '0.5px solid #993C1D',
        }}
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
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMoveToRow?: (clipId: string, rowId: string) => void;
  snapPointsSec?: number[];
  onTrimHoverTimeChange?: (timeSec: number | null) => void;
};

function WorkspaceImageTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onMoveToRow,
  snapPointsSec,
  onTrimHoverTimeChange,
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
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useWorkspaceTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow: onMoveToRow ? (targetRowId) => onMoveToRow(clip.id, targetRowId) : undefined,
    onLiveUpdate: onTrimHoverTimeChange,
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
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMoveToRow?: (clipId: string, rowId: string) => void;
  snapPointsSec?: number[];
  onTrimHoverTimeChange?: (timeSec: number | null) => void;
};

type WorkspaceAudioClipProps = {
  clip: Clip;
  durationSec: number;
  selected: boolean;
  rowId: string;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onMoveToRow?: (clipId: string, rowId: string) => void;
  snapPointsSec?: number[];
  onTrimHoverTimeChange?: (timeSec: number | null) => void;
};

function WorkspaceVideoTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onMoveToRow,
  snapPointsSec,
  onTrimHoverTimeChange,
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
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useWorkspaceTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow: onMoveToRow ? (targetRowId) => onMoveToRow(clip.id, targetRowId) : undefined,
    onLiveUpdate: onTrimHoverTimeChange,
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
        className="absolute top-1 bottom-1 min-h-[36px] min-w-8 overflow-hidden rounded ring-1 ring-inset ring-violet-400/50 bg-[#1e1033]"
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          border: selected ? '2px solid #5DCAA5' : undefined,
        }}
      >
        {ghostLeftPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 bg-black/40"
            style={{ width: `${Math.min(100, ghostLeftPct)}%` }}
            aria-hidden
          />
        ) : null}
        {ghostRightPct > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 bg-black/40"
            style={{ width: `${Math.min(100, ghostRightPct)}%` }}
            aria-hidden
          />
        ) : null}
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

function WorkspaceAudioTimelineClip({
  clip,
  durationSec,
  selected,
  rowId,
  trackLaneRef,
  onSelect,
  onMoveToRow,
  snapPointsSec,
  onTrimHoverTimeChange,
}: WorkspaceAudioClipProps) {
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);
  const startTime = clip.start * durationSec;
  const endTime = (clip.start + clip.width) * durationSec;

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateAudioTrack(clip.id, patch);
    },
    [clip.id, updateAudioTrack],
  );

  const {
    clipStyle,
    isDragging,
    dragType,
    previewRange,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useWorkspaceTimelineClipDrag({
    layerId: clip.id,
    startTime,
    endTime,
    duration: durationSec,
    trackLaneRef,
    onUpdate: onClipUpdate,
    currentRowId: rowId,
    onMoveToRow: onMoveToRow ? (targetRowId) => onMoveToRow(clip.id, targetRowId) : undefined,
    onLiveUpdate: onTrimHoverTimeChange,
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

  const isMusic = clip.audioType === 'music';
  const bg = isMusic ? '#0a1612' : '#0a1a2a';
  const border = selected
    ? isMusic
      ? '2px solid #1D9E75'
      : '2px solid #378ADD'
    : isMusic
      ? '0.5px solid #1D9E75'
      : '0.5px solid #185FA5';

  return (
    <>
      <div
        data-timeline-clip
        className="absolute top-1 flex h-[calc(100%-0.5rem)] min-w-8 touch-none items-center overflow-hidden rounded px-2 text-[10px] font-medium ring-1 ring-inset"
        style={{ ...clipStyle, boxSizing: 'border-box', background: bg, color: '#D4D4D8', border }}
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
              style={{ width: 6, background: 'rgba(255,255,255,0.3)', cursor: 'col-resize' }}
              aria-hidden
              onMouseDown={handlers.onLeftHandleMouseDown}
            />
            <div
              className="absolute top-0 right-0 bottom-0 z-10"
              style={{ width: 6, background: 'rgba(255,255,255,0.3)', cursor: 'col-resize' }}
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
  playheadTimeSec?: number;
  onTrimHoverTimeChange?: (timeSec: number | null) => void;
  /** Selected timeline clip id (`main-video` or a text layer id). */
  selectedTimelineClipId?: string | null;
  /** Clear timeline clip selection (empty video / text lane click). */
  onTimelineDeselect?: () => void;
  /** Select a clip (video or text) and sync the active tool in the shell. */
  onTimelineClipSelect?: (clipId: string) => void;
  onTimelineClipMoveRow?: (clipId: string, rowId: string) => void;
  /** When true, show split-at-playhead control in the transport row. */
  trimToolActive?: boolean;
  splitAtPlayheadLabel?: string;
  splitAtPlayheadAriaLabel?: string;
  onSplitAtPlayhead?: () => void;
  deleteSegmentLabel?: string;
  deleteSegmentAriaLabel?: string;
  deleteSegmentEnabled?: boolean;
  onDeleteVideoSegment?: () => void;
  trimHeadLabel?: string;
  trimHeadAriaLabel?: string;
  onTrimHeadAtPlayhead?: () => void;
  trimTailLabel?: string;
  trimTailAriaLabel?: string;
  onTrimTailAtPlayhead?: () => void;
  trimMiddleLabel?: string;
  trimMiddleAriaLabel?: string;
  trimMiddleEnabled?: boolean;
  onTrimMiddleAtPlayhead?: () => void;
  selectedAudioTrackId?: string | null;
  onTimelineAudioClipSelect?: (clipId: string) => void;
  audioUploadVisible?: boolean;
  addAudioLabel?: string;
  onAddAudio?: () => void;
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
  playheadTimeSec = 0,
  onTrimHoverTimeChange,
  selectedTimelineClipId = null,
  onTimelineDeselect,
  onTimelineClipSelect,
  onTimelineClipMoveRow,
  trimToolActive = false,
  splitAtPlayheadLabel = 'Split',
  splitAtPlayheadAriaLabel,
  onSplitAtPlayhead,
  deleteSegmentLabel = 'Delete clip',
  deleteSegmentAriaLabel,
  deleteSegmentEnabled = false,
  onDeleteVideoSegment,
  trimHeadLabel = 'Left trim',
  trimHeadAriaLabel,
  onTrimHeadAtPlayhead,
  trimTailLabel = 'Right trim',
  trimTailAriaLabel,
  onTrimTailAtPlayhead,
  trimMiddleLabel = 'Remove segment',
  trimMiddleAriaLabel,
  trimMiddleEnabled = false,
  onTrimMiddleAtPlayhead,
  selectedAudioTrackId = null,
  onTimelineAudioClipSelect,
  audioUploadVisible = false,
  addAudioLabel = 'Add audio',
  onAddAudio,
}: WorkspaceTimelineDockProps) {
  const timelineSeekRef = useRef<HTMLDivElement>(null);
  const scrubPointerIdRef = useRef<number | null>(null);
  const videoTrackLaneRef = useRef<HTMLDivElement>(null);
  const textTrackLaneRef = useRef<HTMLDivElement>(null);
  const blurTrackLaneRef = useRef<HTMLDivElement>(null);
  const imageTrackLaneRef = useRef<HTMLDivElement>(null);
  const audioTrackLaneRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [clipDragGuideRatios, setClipDragGuideRatios] = useState<number[] | null>(null);

  const parsedSpeed = Number.parseFloat(speedValue);
  const timelineSpeed = Number.isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 1;
  const rawRulerStepSec = Math.max(0.1, rulerStepSec * timelineSpeed);

  const ticks: number[] = [];
  const safeDuration = Math.max(durationSec, 1e-6);
  for (let t = 0; t <= durationSec; t += rawRulerStepSec) {
    ticks.push(t);
  }
  const lastTick = ticks[ticks.length - 1];
  if (lastTick == null || Math.abs(lastTick - durationSec) > 1e-6) {
    ticks.push(durationSec);
  }

  const formatRulerTick = (rawSeconds: number) => {
    const sec = Math.max(0, rawSeconds / timelineSpeed);
    const rounded = Math.round(sec * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}s` : `${rounded.toFixed(1)}s`;
  };

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
      /* already released */
    }
  };

  const transportDisabled = phase !== 'ready';

  return (
    <div className="flex h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-zinc-200/90 bg-zinc-100/98 dark:border-white/10 dark:bg-black/90">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200/80 px-2 py-2 dark:border-white/5 sm:gap-3 sm:px-3">
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
        {trimToolActive && !transportDisabled ? (
          <div className="flex max-w-[min(100%,28rem)] flex-wrap items-center gap-1">
            {onTrimHeadAtPlayhead != null ? (
              <button
                type="button"
                aria-label={trimHeadAriaLabel ?? trimHeadLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrimHeadAtPlayhead();
                }}
                className="rounded-md border border-sky-600/35 bg-sky-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900 transition-colors hover:bg-sky-500/20 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100"
              >
                {trimHeadLabel}
              </button>
            ) : null}
            {onTrimTailAtPlayhead != null ? (
              <button
                type="button"
                aria-label={trimTailAriaLabel ?? trimTailLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrimTailAtPlayhead();
                }}
                className="rounded-md border border-sky-600/35 bg-sky-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900 transition-colors hover:bg-sky-500/20 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100"
              >
                {trimTailLabel}
              </button>
            ) : null}
            {onTrimMiddleAtPlayhead != null ? (
              <button
                type="button"
                aria-label={trimMiddleAriaLabel ?? trimMiddleLabel}
                disabled={!trimMiddleEnabled}
                title={!trimMiddleEnabled ? trimMiddleAriaLabel : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (trimMiddleEnabled) onTrimMiddleAtPlayhead();
                }}
                className="rounded-md border border-violet-600/40 bg-violet-100/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-900 transition-colors hover:bg-violet-200/90 disabled:pointer-events-none disabled:opacity-35 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/20"
              >
                {trimMiddleLabel}
              </button>
            ) : null}
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
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/45 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-35 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:bg-rose-500/20"
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
            className="rounded-md border border-zinc-300 bg-white py-1.5 pl-2 pr-7 text-xs text-foreground outline-none focus:border-violet-500/45 focus:ring-1 focus:ring-violet-400/30 dark:border-white/10 dark:bg-black/50"
          >
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </label>
        {audioUploadVisible ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddAudio}
              className="rounded-md border border-emerald-600/30 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100/90 dark:border-transparent dark:bg-[#0a1612] dark:text-[#1D9E75] dark:ring-1 dark:ring-[#1D9E75]/60 dark:hover:bg-[#0f2218]"
            >
              {addAudioLabel}
            </button>
          </div>
        ) : null}
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
            className="h-1 w-full max-w-[120px] min-w-[72px] cursor-pointer appearance-none rounded-full bg-zinc-200 accent-violet-600 dark:bg-white/10 dark:accent-violet-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-400 [&::-webkit-slider-thumb]:bg-white dark:[&::-webkit-slider-thumb]:border-violet-300 dark:[&::-webkit-slider-thumb]:bg-zinc-900"
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
        <WorkspaceTimelineDragGuideContext.Provider value={setClipDragGuideRatios}>
          <div className="flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
            <div
              className="relative flex min-w-[720px] flex-col bg-zinc-100/95 dark:bg-black/25"
              role="presentation"
            >
              <div
                ref={timelineSeekRef}
                className="relative ml-0 mr-0 flex min-h-0 w-full flex-col max-sm:ml-[max(14px,env(safe-area-inset-left))] max-sm:mr-[max(14px,env(safe-area-inset-right))]"
                role="presentation"
              >
              <div
                className="relative h-9 shrink-0 cursor-grab touch-none border-b border-zinc-300/90 bg-zinc-200/80 active:cursor-grabbing dark:border-white/10 dark:bg-black/40 sm:h-7"
                onPointerDown={onScrubPointerDown}
                onPointerMove={onScrubPointerMove}
                onPointerUp={onScrubPointerUpOrCancel}
                onPointerCancel={onScrubPointerUpOrCancel}
              >
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="pointer-events-none absolute top-1 font-mono text-[10px] text-muted"
                    style={{ left: `${(t / safeDuration) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    {formatRulerTick(t)}
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
                          : row.id === 'image'
                            ? imageTrackLaneRef
                            : row.id === 'audio'
                              ? audioTrackLaneRef
                            : undefined
                  }
                  className={
                    row.id === 'video'
                      ? 'relative h-12 min-h-12 shrink-0 border-b border-zinc-200/80 bg-white/80 dark:border-white/5 dark:bg-black/20'
                      : 'relative h-8 shrink-0 border-b border-zinc-200/80 bg-white/80 dark:border-white/5 dark:bg-black/20'
                  }
                  onMouseDown={
                    row.id === 'text' ||
                    row.id === 'video' ||
                    row.id === 'blur' ||
                    row.id === 'image' ||
                    row.id === 'audio' ||
                    row.id === 'subtitle'
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
                    const clipStartSec = clip.start * durationSec;
                    const clipEndSec = (clip.start + clip.width) * durationSec;
                    const snapPointsSec = [
                      ...rowClipEdgesSec.filter(
                        (value) =>
                          Math.abs(value - clipStartSec) > 1e-4 &&
                          Math.abs(value - clipEndSec) > 1e-4,
                      ),
                      playheadTimeSec,
                    ].filter((value) => Number.isFinite(value));
                    if (clip.kind === 'video' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceVideoTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          rowId={row.id}
                          trackLaneRef={videoTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                          onMoveToRow={onTimelineClipMoveRow}
                          snapPointsSec={snapPointsSec}
                          onTrimHoverTimeChange={onTrimHoverTimeChange}
                        />
                      );
                    }
                    if (clip.kind === 'text' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceTextTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          rowId={row.id}
                          trackLaneRef={textTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                          onMoveToRow={onTimelineClipMoveRow}
                          snapPointsSec={snapPointsSec}
                          onTrimHoverTimeChange={onTrimHoverTimeChange}
                        />
                      );
                    }
                    if (clip.kind === 'blur' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceBlurTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          rowId={row.id}
                          trackLaneRef={blurTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                          onMoveToRow={onTimelineClipMoveRow}
                          snapPointsSec={snapPointsSec}
                          onTrimHoverTimeChange={onTrimHoverTimeChange}
                        />
                      );
                    }
                    if (clip.kind === 'image' && onTimelineClipSelect != null) {
                      return (
                        <WorkspaceImageTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedTimelineClipId}
                          rowId={row.id}
                          trackLaneRef={imageTrackLaneRef}
                          onSelect={onTimelineClipSelect}
                          onMoveToRow={onTimelineClipMoveRow}
                          snapPointsSec={snapPointsSec}
                          onTrimHoverTimeChange={onTrimHoverTimeChange}
                        />
                      );
                    }
                    if (clip.kind === 'audio' && onTimelineAudioClipSelect != null) {
                      return (
                        <WorkspaceAudioTimelineClip
                          key={clip.id}
                          clip={clip}
                          durationSec={durationSec}
                          selected={clip.id === selectedAudioTrackId}
                          rowId={row.id}
                          trackLaneRef={audioTrackLaneRef}
                          onSelect={onTimelineAudioClipSelect}
                          onMoveToRow={onTimelineClipMoveRow}
                          snapPointsSec={snapPointsSec}
                          onTrimHoverTimeChange={onTrimHoverTimeChange}
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
              );})}
              </div>

              <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
                {clipDragGuideRatios?.map((ratio, i) => (
                  <div
                    key={`guide-${i}-${ratio}`}
                    className="pointer-events-none absolute bottom-0 top-0 z-11 w-0 -translate-x-1/2 border-l-2 border-dashed border-amber-400/85"
                    style={{ left: `${ratio * 100}%` }}
                  />
                ))}
              </div>

              <div
                className="pointer-events-none absolute bottom-0 top-0 z-[11] w-px max-sm:-translate-x-1/2 sm:translate-x-0 bg-violet-400"
                style={{ left: `${playheadPosition * 100}%` }}
              >
                <div className="absolute -left-2 top-0 h-3 w-4 rounded-sm bg-violet-400 shadow-sm ring-1 ring-violet-200/40 max-sm:h-3.5 max-sm:w-[18px] sm:-left-1.5 sm:h-2.5 sm:w-3.5" />
              </div>

              {/* Tall touch strip only on small screens; pointer capture keeps scrubbing smooth past this box */}
              <div
                className="absolute top-0 z-[15] hidden h-36 w-11 max-sm:block max-sm:touch-none"
                style={{
                  left: `${playheadPosition * 100}%`,
                  transform: 'translateX(-50%)',
                }}
                onPointerDown={onScrubPointerDown}
                onPointerMove={onScrubPointerMove}
                onPointerUp={onScrubPointerUpOrCancel}
                onPointerCancel={onScrubPointerUpOrCancel}
              />
              </div>
            </div>
          </div>
        </WorkspaceTimelineDragGuideContext.Provider>
      )}
    </div>
  );
}
