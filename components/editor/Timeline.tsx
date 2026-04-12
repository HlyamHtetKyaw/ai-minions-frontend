'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { AudioTrackWaveform } from '@/components/editor/AudioTrackWaveform';
import { AudioWaveform } from '@/components/editor/AudioWaveform';
import { useTimelineClipDrag } from '@/hooks/useTimelineClipDrag';
import { useTrimHandles } from '@/hooks/useTrimHandles';
import { useEditorStore } from '@/store/editorStore';
import type {
  AudioTrack,
  BlurLayer as BlurLayerModel,
  ImageLayer as ImageLayerModel,
  TextLayer,
} from '@/store/editorStore';

function truncateText(s: string, max = 24) {
  const t = s.trim() || 'Text';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function truncateFileName(s: string, max = 18) {
  const t = s.trim() || 'Image';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Greedy lane assignment for overlapping image clips (slight vertical stack). */
function assignImageTimelineVerticalLane(layers: ImageLayerModel[]) {
  const sorted = [...layers].sort(
    (a, b) =>
      a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id),
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

function clampSeekTime(t: number, lo: number, hi: number) {
  if (hi <= lo) return t;
  return Math.min(Math.max(t, lo), hi);
}

type TimelineVideoClipProps = {
  duration: number;
  playbackSpeed: number;
};

function TimelineVideoClip({ duration, playbackSpeed }: TimelineVideoClipProps) {
  const trimStart = useEditorStore((s) => s.trimStart);
  const trimEnd = useEditorStore((s) => s.trimEnd);
  const laneRef = useRef<HTMLDivElement>(null);
  const {
    leftTooltip,
    rightTooltip,
    onLeftHandleMouseDown,
    onRightHandleMouseDown,
  } = useTrimHandles({ trackLaneRef: laneRef, duration });

  const showSpeedBadge = Math.abs(playbackSpeed - 1) > 0.001;
  const leftOverlayPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const rightOverlayPct = duration > 0 ? ((duration - trimEnd) / duration) * 100 : 0;
  const leftHandlePct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const rightHandlePct = duration > 0 ? (trimEnd / duration) * 100 : 0;

  return (
    <>
      <div
        ref={laneRef}
        className="absolute inset-y-1 left-0 right-0 overflow-hidden rounded bg-sky-600/35 ring-1 ring-sky-500/40"
        aria-hidden
      >
        <div
          className="pointer-events-none absolute top-0 bottom-0 left-0 z-[1]"
          style={{
            width: `${leftOverlayPct}%`,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
        <div
          className="pointer-events-none absolute top-0 right-0 bottom-0 z-[1]"
          style={{
            width: `${rightOverlayPct}%`,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
        {showSpeedBadge && (
          <span
            className="pointer-events-none absolute z-[2] text-[9px] font-medium text-white"
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
        <div
          role="slider"
          tabIndex={-1}
          aria-label="Trim start"
          className="absolute top-0 bottom-0 z-20 w-[10px] cursor-col-resize"
          style={{
            left: `${leftHandlePct}%`,
            transform: 'translateX(-50%)',
            background: '#EF9F27',
            borderRadius: '5px 0 0 5px',
          }}
          onMouseDown={onLeftHandleMouseDown}
        />
        <div
          role="slider"
          tabIndex={-1}
          aria-label="Trim end"
          className="absolute top-0 bottom-0 z-20 w-[10px] cursor-col-resize"
          style={{
            left: `${rightHandlePct}%`,
            transform: 'translateX(-50%)',
            background: '#EF9F27',
            borderRadius: '0 5px 5px 0',
          }}
          onMouseDown={onRightHandleMouseDown}
        />
      </div>
      {leftTooltip != null && (
        <div
          className="pointer-events-none fixed z-100 whitespace-nowrap"
          style={{
            left: leftTooltip.x,
            top: leftTooltip.y,
            transform: 'translate(-50%, calc(-100% - 4px))',
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: 10,
            borderRadius: 4,
            padding: '3px 7px',
          }}
        >
          {leftTooltip.text}
        </div>
      )}
      {rightTooltip != null && (
        <div
          className="pointer-events-none fixed z-100 whitespace-nowrap"
          style={{
            left: rightTooltip.x,
            top: rightTooltip.y,
            transform: 'translate(-50%, calc(-100% - 4px))',
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: 10,
            borderRadius: 4,
            padding: '3px 7px',
          }}
        >
          {rightTooltip.text}
        </div>
      )}
    </>
  );
}

type TextTimelineClipProps = {
  layer: TextLayer;
  duration: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  setSelectedLayerId: (id: string | null) => void;
};

function TextTimelineClip({
  layer,
  duration,
  selected,
  trackLaneRef,
  setSelectedLayerId,
}: TextTimelineClipProps) {
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateTextLayer(layer.id, patch);
    },
    [layer.id, updateTextLayer],
  );

  const {
    clipStyle,
    isDragging,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: layer.id,
    startTime: layer.startTime,
    endTime: layer.endTime,
    duration,
    trackLaneRef,
    onUpdate: onClipUpdate,
  });

  return (
    <>
      <div
        data-timeline-clip
        className="absolute top-1 bottom-1 z-5 min-w-[4px] overflow-hidden rounded"
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          background: '#1a2a22',
          color: '#5DCAA5',
          border: selected ? '2px solid #5DCAA5' : 'none',
        }}
        title={layer.content}
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex items-center px-1 text-left text-[10px] font-medium leading-none select-none'
              : 'absolute inset-0 flex items-center px-1 text-left text-[10px] font-medium leading-none select-none'
          }
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={(e) => {
            setSelectedAudioTrackId(null);
            setSelectedLayerId(layer.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          <span className="truncate">{truncateText(layer.content)}</span>
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

type BlurTimelineClipProps = {
  layer: BlurLayerModel;
  duration: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  setSelectedLayerId: (id: string | null) => void;
};

function BlurTimelineClip({
  layer,
  duration,
  selected,
  trackLaneRef,
  setSelectedLayerId,
}: BlurTimelineClipProps) {
  const updateBlurLayer = useEditorStore((s) => s.updateBlurLayer);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateBlurLayer(layer.id, patch);
    },
    [layer.id, updateBlurLayer],
  );

  const {
    clipStyle,
    isDragging,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: layer.id,
    startTime: layer.startTime,
    endTime: layer.endTime,
    duration,
    trackLaneRef,
    onUpdate: onClipUpdate,
  });

  return (
    <>
      <div
        data-timeline-clip
        className="absolute top-1 bottom-1 z-5 min-w-[4px] overflow-hidden rounded"
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex items-center px-1 text-left text-[10px] font-medium leading-none select-none'
              : 'absolute inset-0 flex items-center px-1 text-left text-[10px] font-medium leading-none select-none'
          }
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={(e) => {
            setSelectedAudioTrackId(null);
            setSelectedLayerId(layer.id);
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

type ImageTimelineClipProps = {
  layer: ImageLayerModel;
  duration: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  setSelectedLayerId: (id: string | null) => void;
  verticalLane: number;
  fileLabel: string;
};

function ImageTimelineClip({
  layer,
  duration,
  selected,
  trackLaneRef,
  setSelectedLayerId,
  verticalLane,
  fileLabel,
}: ImageTimelineClipProps) {
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateImageLayer(layer.id, patch);
    },
    [layer.id, updateImageLayer],
  );

  const {
    clipStyle,
    isDragging,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: layer.id,
    startTime: layer.startTime,
    endTime: layer.endTime,
    duration,
    trackLaneRef,
    onUpdate: onClipUpdate,
  });

  const topPx = 4 + verticalLane * 6;

  return (
    <>
      <div
        data-timeline-clip
        className="absolute z-5 min-w-[4px] overflow-hidden rounded"
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] flex min-w-0 items-center gap-1 px-1 text-left text-[10px] font-medium leading-none select-none'
              : 'absolute inset-0 flex min-w-0 items-center gap-1 px-1 text-left text-[10px] font-medium leading-none select-none'
          }
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={(e) => {
            setSelectedAudioTrackId(null);
            setSelectedLayerId(layer.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layer.src}
            alt=""
            className="h-4 w-4 shrink-0 rounded-sm object-cover"
            width={16}
            height={16}
          />
          <span className="min-w-0 truncate">{truncateFileName(fileLabel)}</span>
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

type AudioTimelineClipProps = {
  track: AudioTrack;
  duration: number;
  selected: boolean;
  trackLaneRef: React.RefObject<HTMLDivElement | null>;
  setSelectedAudioTrackId: (id: string | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  variant: 'music' | 'voiceover';
};

function AudioTimelineClip({
  track,
  duration,
  selected,
  trackLaneRef,
  setSelectedAudioTrackId,
  setSelectedLayerId,
  variant,
}: AudioTimelineClipProps) {
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);

  const onClipUpdate = useCallback(
    (patch: { startTime?: number; endTime?: number }) => {
      updateAudioTrack(track.id, patch);
    },
    [track.id, updateAudioTrack],
  );

  const {
    clipStyle,
    isDragging,
    tooltipText,
    tooltipPosition,
    handlers,
  } = useTimelineClipDrag({
    layerId: track.id,
    startTime: track.startTime,
    endTime: track.endTime,
    duration,
    trackLaneRef,
    onUpdate: onClipUpdate,
  });

  const isMusic = variant === 'music';
  const clipBg = isMusic ? '#0a1612' : '#0a1a2a';
  const clipBorder = isMusic ? '0.5px solid #1D9E75' : '0.5px solid #185FA5';

  return (
    <>
      <div
        data-timeline-clip
        className="absolute top-1 bottom-1 z-5 min-w-[4px] overflow-hidden rounded"
        style={{
          ...clipStyle,
          boxSizing: 'border-box',
          background: clipBg,
          border: clipBorder,
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
              ? 'absolute top-0 right-[6px] bottom-0 left-[6px] min-h-0 min-w-0'
              : 'absolute inset-0 min-h-0 min-w-0'
          }
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={(e) => {
            setSelectedLayerId(null);
            setSelectedAudioTrackId(track.id);
            handlers.onBodyMouseDown(e);
          }}
        >
          <AudioTrackWaveform
            track={track}
            duration={duration}
            isSelected={selected}
          />
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

type AudioTrackRowProps = {
  track: AudioTrack;
  duration: number;
  selectedAudioTrackId: string | null;
  setSelectedAudioTrackId: (id: string | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  variant: 'music' | 'voiceover';
};

function AudioTrackRow({
  track,
  duration,
  selectedAudioTrackId,
  setSelectedAudioTrackId,
  setSelectedLayerId,
  variant,
}: AudioTrackRowProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const isMusic = variant === 'music';

  return (
    <div>
      <div
        className={`mb-0.5 text-[10px] font-medium uppercase tracking-wide ${
          isMusic ? 'text-[#1D9E75]' : 'text-[#378ADD]'
        }`}
      >
        {isMusic ? 'music' : 'voice'}
      </div>
      <div
        ref={laneRef}
        className="relative h-10 w-full rounded bg-zinc-900/90 ring-1 ring-zinc-700/80"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.stopPropagation();
            setSelectedLayerId(null);
            setSelectedAudioTrackId(null);
          }
        }}
      >
        <AudioTimelineClip
          track={track}
          duration={duration}
          selected={track.id === selectedAudioTrackId}
          trackLaneRef={laneRef}
          setSelectedAudioTrackId={setSelectedAudioTrackId}
          setSelectedLayerId={setSelectedLayerId}
          variant={variant}
        />
      </div>
    </div>
  );
}

export function Timeline() {
  const videoSrc = useEditorStore((s) => s.videoSrc);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const textLayers = useEditorStore((s) => s.textLayers);
  const blurLayers = useEditorStore((s) => s.blurLayers);
  const imageLayers = useEditorStore((s) => s.imageLayers);
  const galleryImages = useEditorStore((s) => s.galleryImages);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const originalAudioMuted = useEditorStore((s) => s.originalAudioMuted);
  const originalAudioVolume = useEditorStore((s) => s.originalAudioVolume);
  const selectedAudioTrackId = useEditorStore((s) => s.selectedAudioTrackId);
  const setOriginalAudioMuted = useEditorStore((s) => s.setOriginalAudioMuted);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);

  const trackRef = useRef<HTMLDivElement>(null);
  const textTrackLaneRef = useRef<HTMLDivElement>(null);
  const blurTrackLaneRef = useRef<HTMLDivElement>(null);
  const imageTrackLaneRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const imageLaneById = useMemo(
    () => assignImageTimelineVerticalLane(imageLayers),
    [imageLayers],
  );

  const musicTracks = audioTracks.filter((t) => t.type === 'music');
  const voiceTracks = audioTracks.filter((t) => t.type === 'voiceover');

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      const v = useEditorStore.getState().videoElement;
      if (!el || !v || duration <= 0 || !Number.isFinite(duration)) return;
      const { trimStart, trimEnd } = useEditorStore.getState();
      const rect = el.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const ratio = rect.width > 0 ? x / rect.width : 0;
      const next = clampSeekTime(ratio * duration, trimStart, trimEnd);
      v.currentTime = next;
      setCurrentTime(next);
    },
    [duration, setCurrentTime],
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

  const onMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return;
    e.preventDefault();
    draggingRef.current = true;
    seekFromClientX(e.clientX);
  };

  if (videoSrc == null) {
    return (
      <div className="flex h-[120px] shrink-0 items-center justify-center border-t border-zinc-800 bg-[#141414] px-4">
        <p className="text-sm text-zinc-500">Upload a video to get started</p>
      </div>
    );
  }

  if (duration <= 0) {
    return (
      <div className="flex h-[120px] shrink-0 items-center justify-center border-t border-zinc-800 bg-[#141414] px-4">
        <p className="text-sm text-zinc-500">Preparing timeline…</p>
      </div>
    );
  }

  const playheadPct = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  const markers: number[] = [];
  for (let t = 0; t <= duration; t += 10) {
    markers.push(t);
  }

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-[#141414] px-3 pb-3 pt-2">
      <div className="relative h-6 select-none">
        {markers.map((t) => (
          <span
            key={t}
            className="absolute top-0 text-[10px] tabular-nums text-zinc-500"
            style={{ left: `${(t / duration) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {t === 0 ? '0s' : `${Math.round(t)}s`}
          </span>
        ))}
      </div>

      <div className="mt-1">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          className="relative cursor-pointer rounded-md bg-zinc-900/90 ring-1 ring-zinc-700/80"
          onMouseDown={onMouseDown}
        >
          <div className="flex flex-col gap-1 p-1">
            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                video
              </div>
              <div className="relative h-10 w-full rounded bg-zinc-900/90 ring-1 ring-zinc-700/80">
                <TimelineVideoClip duration={duration} playbackSpeed={playbackSpeed} />
              </div>
            </div>

            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                text
              </div>
              <div
                ref={textTrackLaneRef}
                className="relative h-10 w-full rounded bg-zinc-900/90 ring-1 ring-zinc-700/80"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    e.stopPropagation();
                    setSelectedLayerId(null);
                    setSelectedAudioTrackId(null);
                  }
                }}
              >
                {textLayers
                  .filter((l) => l.type === 'text')
                  .map((layer) => (
                    <TextTimelineClip
                      key={layer.id}
                      layer={layer}
                      duration={duration}
                      selected={layer.id === selectedLayerId}
                      trackLaneRef={textTrackLaneRef}
                      setSelectedLayerId={setSelectedLayerId}
                    />
                  ))}
              </div>
            </div>

            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                blur
              </div>
              <div
                ref={blurTrackLaneRef}
                className="relative h-10 w-full rounded bg-zinc-900/90 ring-1 ring-zinc-700/80"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    e.stopPropagation();
                    setSelectedLayerId(null);
                    setSelectedAudioTrackId(null);
                  }
                }}
              >
                {blurLayers.map((layer) => (
                  <BlurTimelineClip
                    key={layer.id}
                    layer={layer}
                    duration={duration}
                    selected={layer.id === selectedLayerId}
                    trackLaneRef={blurTrackLaneRef}
                    setSelectedLayerId={setSelectedLayerId}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                image
              </div>
              <div
                ref={imageTrackLaneRef}
                className="relative h-10 w-full rounded bg-zinc-900/90 ring-1 ring-zinc-700/80"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    e.stopPropagation();
                    setSelectedLayerId(null);
                    setSelectedAudioTrackId(null);
                  }
                }}
              >
                {imageLayers.map((layer) => {
                  const meta = galleryImages.find((g) => g.id === layer.galleryImageId);
                  return (
                    <ImageTimelineClip
                      key={layer.id}
                      layer={layer}
                      duration={duration}
                      selected={layer.id === selectedLayerId}
                      trackLaneRef={imageTrackLaneRef}
                      setSelectedLayerId={setSelectedLayerId}
                      verticalLane={imageLaneById.get(layer.id) ?? 0}
                      fileLabel={meta?.name ?? 'Image'}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                <span>original</span>
                <button
                  type="button"
                  title={originalAudioMuted ? 'Unmute original' : 'Mute original'}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOriginalAudioMuted(!originalAudioMuted);
                  }}
                >
                  {originalAudioMuted ? (
                    <VolumeX className="h-3.5 w-3.5 text-red-400/90" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="relative h-10 w-full rounded bg-zinc-900/90 ring-1 ring-zinc-700/80">
                <div
                  className="absolute inset-y-1 left-0 overflow-hidden rounded"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#1a1a1a',
                    border: '0.5px solid #333',
                  }}
                >
                  <div
                    className="absolute top-1/2 left-1 h-1.5 max-w-[calc(100%-8px)] -translate-y-1/2 rounded-sm"
                    style={{
                      width: `${originalAudioVolume}%`,
                      background: originalAudioMuted ? 'rgba(239,68,68,0.55)' : '#888',
                    }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>

            {musicTracks.map((track) => (
              <AudioTrackRow
                key={track.id}
                track={track}
                duration={duration}
                selectedAudioTrackId={selectedAudioTrackId}
                setSelectedAudioTrackId={setSelectedAudioTrackId}
                setSelectedLayerId={setSelectedLayerId}
                variant="music"
              />
            ))}

            {voiceTracks.map((track) => (
              <AudioTrackRow
                key={track.id}
                track={track}
                duration={duration}
                selectedAudioTrackId={selectedAudioTrackId}
                setSelectedAudioTrackId={setSelectedAudioTrackId}
                setSelectedLayerId={setSelectedLayerId}
                variant="voiceover"
              />
            ))}

            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                video audio
              </div>
              <div className="flex h-7 w-full min-w-0 items-center">
                <AudioWaveform />
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
            style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }}
          />
        </div>
      </div>
    </div>
  );
}
