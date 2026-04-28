'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { resolveAppliedCropDisplayMargins } from '@/components/editor/crop-display-margins';
import { MAIN_VIDEO_TIMELINE_CLIP_ID, useEditorStore } from '@/store/editorStore';
import { MediaUpload } from '@/components/editor/MediaUpload';
import { TextLayer } from '@/components/editor/layers/TextLayer';
import { BlurLayer } from '@/components/editor/layers/BlurLayer';
import { ImageLayer } from '@/components/editor/layers/ImageLayer';
import { CropOverlay } from '@/components/editor/layers/CropOverlay';
import { VIDEO_FILE_ACCEPT_ATTR } from '@/components/editor/video-file';
import { applyLocalVideoFileWithWorkspaceUpload } from '@/lib/workspace-video-source';
import {
  GALLERY_IMAGE_DRAG_MIME,
  parseGalleryImageDragPayload,
} from '@/lib/galleryImageDrag';
import {
  clampTimeToVideoSegments,
  sortVideoSegments,
} from '@/lib/videoSegmentTime';

type CanvasAspectId = '16:9' | '9:16' | '1:1' | '4:3';

function aspectIdToRatio(aspect: CanvasAspectId): number {
  if (aspect === '16:9') return 16 / 9;
  if (aspect === '9:16') return 9 / 16;
  if (aspect === '1:1') return 1;
  return 4 / 3;
}

function ratioToAspectId(ratio: number): CanvasAspectId {
  const options: Array<{ id: CanvasAspectId; ratio: number }> = [
    { id: '16:9', ratio: 16 / 9 },
    { id: '9:16', ratio: 9 / 16 },
    { id: '1:1', ratio: 1 },
    { id: '4:3', ratio: 4 / 3 },
  ];
  const nearest = options.reduce((best, item) =>
    Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best,
  );
  return Math.abs(nearest.ratio - ratio) <= 0.01 ? nearest.id : '16:9';
}

function aspectIdToCssRatio(aspect: CanvasAspectId): string {
  if (aspect === '16:9') return '16 / 9';
  if (aspect === '9:16') return '9 / 16';
  if (aspect === '1:1') return '1 / 1';
  return '4 / 3';
}

type VideoCanvasProps = {
  fileInputId?: string;
  objectFit?: 'contain' | 'cover';
  /** Parent already handled “choose canvas size” (e.g. video-edit workspace shell). */
  skipInitialCanvasSizeStep?: boolean;
};

export function VideoCanvas({
  fileInputId,
  objectFit = 'contain',
  skipInitialCanvasSizeStep = false,
}: VideoCanvasProps = {}) {
  const videoSrc = useEditorStore((s) => s.videoSrc);
  const currentTime = useEditorStore((s) => s.currentTime);
  const textLayers = useEditorStore((s) => s.textLayers);
  const blurLayers = useEditorStore((s) => s.blurLayers);
  const imageLayers = useEditorStore((s) => s.imageLayers);
  const isCropActive = useEditorStore((s) => s.isCropActive);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const setDuration = useEditorStore((s) => s.setDuration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setVideoElement = useEditorStore((s) => s.setVideoElement);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const setVideoNaturalSize = useEditorStore((s) => s.setVideoNaturalSize);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const setVideoSrc = useEditorStore((s) => s.setVideoSrc);
  const setCropSettings = useEditorStore((s) => s.setCropSettings);
  const trimStart = useEditorStore((s) => s.trimStart);
  const trimEnd = useEditorStore((s) => s.trimEnd);
  const videoTimelineSegments = useEditorStore((s) => s.videoTimelineSegments);
  const videoSegments = useEditorStore((s) => s.videoSegments);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const duration = useEditorStore((s) => s.duration);
  const cropSettings = useEditorStore((s) => s.cropSettings);
  const videoNaturalWidth = useEditorStore((s) => s.videoNaturalWidth);
  const videoNaturalHeight = useEditorStore((s) => s.videoNaturalHeight);
  const originalAudioMuted = useEditorStore((s) => s.originalAudioMuted);
  const originalAudioVolume = useEditorStore((s) => s.originalAudioVolume);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [canvasSizeChosen, setCanvasSizeChosen] = useState<boolean>(videoSrc != null);
  const [pendingCanvasAspect, setPendingCanvasAspect] = useState<CanvasAspectId>('16:9');

  useEffect(() => {
    if (videoSrc != null) {
      setCanvasSizeChosen(true);
    }
  }, [videoSrc]);

  useEffect(() => {
    setPendingCanvasAspect(ratioToAspectId(cropSettings.easyAspect));
  }, [cropSettings.easyAspect]);

  const clampVideoTime = useCallback(
    (t: number) => {
      const segs = videoTimelineSegments;
      if (segs.length === 0) {
        const lo = trimStart;
        const hi = trimEnd;
        if (hi <= lo) return t;
        return Math.min(Math.max(t, lo), hi);
      }
      if (segs.length === 1) {
        const s = segs[0];
        return Math.min(Math.max(t, s.startTime), s.endTime);
      }
      return clampTimeToVideoSegments(t, segs, duration);
    },
    [duration, trimEnd, trimStart, videoTimelineSegments],
  );

  const videoTimelineClipSelected =
    selectedLayerId != null &&
    (videoTimelineSegments.some((s) => s.id === selectedLayerId) ||
      (videoTimelineSegments.length === 0 && selectedLayerId === MAIN_VIDEO_TIMELINE_CLIP_ID));

  const onFrameDragOver = useCallback((e: DragEvent) => {
    if (videoSrc == null) return;
    const types = e.dataTransfer.types;
    if (
      types.includes(GALLERY_IMAGE_DRAG_MIME) ||
      types.includes('text/plain') ||
      types.includes('Text')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [videoSrc]);

  const onFrameDrop = useCallback(
    (e: DragEvent) => {
      if (videoSrc == null) return;
      let galleryId = e.dataTransfer.getData(GALLERY_IMAGE_DRAG_MIME);
      if (!galleryId) {
        galleryId =
          parseGalleryImageDragPayload(e.dataTransfer.getData('text/plain')) ?? '';
      }
      if (!galleryId) return;
      e.preventDefault();
      e.stopPropagation();
      const st = useEditorStore.getState();
      const gi = st.galleryImages.find((g) => g.id === galleryId);
      if (!gi) return;
      st.addImageLayer(gi);
      st.setActiveTool('image');
      const rect = frameContainerRef.current?.getBoundingClientRect();
      const next = useEditorStore.getState();
      const lid = next.selectedLayerId;
      const layer = lid != null ? next.imageLayers.find((l) => l.id === lid) : undefined;
      if (rect && layer) {
        let x = e.clientX - rect.left - layer.width / 2;
        let y = e.clientY - rect.top - layer.height / 2;
        const maxX = Math.max(0, rect.width - layer.width);
        const maxY = Math.max(0, rect.height - layer.height);
        x = Math.min(Math.max(0, x), maxX);
        y = Math.min(Math.max(0, y), maxY);
        useEditorStore.getState().updateImageLayer(layer.id, { x, y });
      }
    },
    [videoSrc],
  );

  const attachRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      setVideoElement(node);
    },
    [setVideoElement],
  );

  useEffect(() => {
    return () => {
      setVideoElement(null);
    };
  }, [setVideoElement]);

  useLayoutEffect(() => {
    const v = videoRef.current;
    if (!v || videoSrc == null) {
      return;
    }
    let lastW = -1;
    let lastH = -1;
    const syncVideoBox = () => {
      const w = v.clientWidth;
      const h = v.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      setFrameSize({ w, h });
    };
    syncVideoBox();
    const ro = new ResizeObserver(syncVideoBox);
    ro.observe(v);
    return () => ro.disconnect();
  }, [videoSrc]);

  useLayoutEffect(() => {
    const el = frameContainerRef.current;
    if (!el || videoSrc == null) {
      return;
    }
    let lastW = -1;
    let lastH = -1;
    const sync = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      setCanvasSize({ width: w, height: h });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [videoSrc, setCanvasSize]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isCropActive) {
      v.pause();
      v.muted = true;
    } else {
      v.muted = false;
      v.volume = originalAudioMuted ? 0 : originalAudioVolume / 100;
    }
  }, [isCropActive, originalAudioMuted, originalAudioVolume]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPlaying) return;
    if (v.currentTime < trimStart - 1e-3) {
      v.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  }, [isPlaying, setCurrentTime, trimStart]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || duration <= 0) return;
    // Paused: mirror `currentTime` as-is so trim-handle scrubbing can preview frames
    // outside the active trim range. Playing: keep the media clock inside trim bounds
    // (the `timeupdate` handler also enforces this; pushing on every store update
    // would cause micro-seeks and pause/play flicker).
    const target = v.paused
      ? Math.min(duration, Math.max(0, currentTime))
      : clampVideoTime(currentTime);
    const drift = Math.abs(v.currentTime - target);
    const maxDriftBeforeSeek = v.paused ? 0.02 : 0.35;
    if (drift > maxDriftBeforeSeek) {
      v.currentTime = target;
    }
  }, [clampVideoTime, currentTime, duration]);

  const visibleTextLayers = textLayers.filter(
    (l) =>
      l.type === 'text' &&
      currentTime >= l.startTime &&
      currentTime <= l.endTime,
  );

  const frameReady = frameSize.w > 0 && frameSize.h > 0;

  const appliedCropClipStyle = useMemo(() => {
    if (!cropSettings.isApplied || isCropActive) return undefined;
    const fw = frameSize.w;
    const fh = frameSize.h;
    if (fw < 2 || fh < 2) return undefined;
    const { top, right, bottom, left } = resolveAppliedCropDisplayMargins(
      cropSettings,
      fw,
      fh,
      videoNaturalWidth,
      videoNaturalHeight,
    );
    const vw = fw - left - right;
    const vh = fh - top - bottom;
    if (vw < 2 || vh < 2) return undefined;
    const inset = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    return {
      clipPath: inset,
      WebkitClipPath: inset,
    } as React.CSSProperties;
  }, [
    cropSettings,
    isCropActive,
    frameSize.w,
    frameSize.h,
    videoNaturalWidth,
    videoNaturalHeight,
  ]);

  if (videoSrc == null) {
    if (!skipInitialCanvasSizeStep && !canvasSizeChosen) {
      return (
        <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-[#121212] p-6">
          <div className="flex w-full max-w-5xl items-center justify-center">
            <div
              className="relative w-full max-w-[min(92vw,1100px)] overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-950/75"
              style={{ aspectRatio: aspectIdToCssRatio(pendingCanvasAspect) }}
            >
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-2xl rounded-xl border border-zinc-700/80 bg-zinc-900/90 p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Start with canvas size
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    Choose your project orientation first. You can add video after this step.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingCanvasAspect('16:9')}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        pendingCanvasAspect === '16:9' || pendingCanvasAspect === '4:3'
                          ? 'border-violet-400/60 bg-violet-500/20 text-foreground'
                          : 'border-white/15 bg-transparent text-zinc-300 hover:border-white/30'
                      }`}
                    >
                      Landscape
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingCanvasAspect('9:16')}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        pendingCanvasAspect === '9:16'
                          ? 'border-violet-400/60 bg-violet-500/20 text-foreground'
                          : 'border-white/15 bg-transparent text-zinc-300 hover:border-white/30'
                      }`}
                    >
                      Portrait
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    {(['16:9', '9:16', '1:1', '4:3'] as const).map((aspect) => (
                      <button
                        key={aspect}
                        type="button"
                        onClick={() => setPendingCanvasAspect(aspect)}
                        className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          pendingCanvasAspect === aspect
                            ? 'border-violet-400/60 bg-violet-500/20 text-foreground'
                            : 'border-white/15 bg-transparent text-zinc-300 hover:border-white/30'
                        }`}
                      >
                        {aspect}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setCropSettings({ easyAspect: aspectIdToRatio(pendingCanvasAspect) });
                        setCanvasSizeChosen(true);
                      }}
                      className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-violet-400/40 hover:bg-violet-500/10"
                    >
                      Continue to editor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-[#121212] p-3 sm:p-4">
        <MediaUpload
          variant="centered"
          fileInputId={fileInputId}
          requireAspectChoice={false}
          defaultAspect={ratioToAspectId(cropSettings.easyAspect)}
        />
      </div>
    );
  }

  return (
    <div
      className="relative h-full min-h-0 w-full bg-black"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedLayerId(null);
        }
      }}
    >
      {fileInputId != null && (
        <input
          id={fileInputId}
          type="file"
          accept={VIDEO_FILE_ACCEPT_ATTR}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const easyAspect = useEditorStore.getState().cropSettings.easyAspect;
              void applyLocalVideoFileWithWorkspaceUpload(file, setVideoSrc, easyAspect).catch(
                (err) => {
                  console.warn('[video-editor] video replace upload failed', err);
                },
              );
            }
            e.target.value = '';
          }}
        />
      )}
      <div
        ref={frameContainerRef}
        role="presentation"
        className="relative h-full w-full min-h-0 overflow-hidden"
        onDragOver={onFrameDragOver}
        onDrop={onFrameDrop}
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (t === e.currentTarget || t.tagName === 'VIDEO') {
            if (!videoTimelineClipSelected) {
              setSelectedLayerId(null);
            }
          }
        }}
      >
        <video
          ref={attachRef}
          src={videoSrc}
          className={`relative z-0 block h-full w-full max-h-full max-w-full ${
            objectFit === 'cover' ? 'object-cover' : 'object-contain'
          } will-change-transform transform-[translateZ(0)] ${
            isCropActive ? 'pointer-events-none opacity-0' : ''
          }`}
          style={appliedCropClipStyle}
          playsInline
          preload="metadata"
          disablePictureInPicture
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (Number.isFinite(v.duration)) {
              setDuration(v.duration);
            }
            setVideoNaturalSize(v.videoWidth, v.videoHeight);
            v.playbackRate = playbackSpeed;
            requestAnimationFrame(() => {
              setFrameSize({ w: v.clientWidth, h: v.clientHeight });
              const box = frameContainerRef.current;
              if (box) {
                setCanvasSize({
                  width: box.clientWidth,
                  height: box.clientHeight,
                });
              }
            });
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            const lo = trimStart;
            const hi = trimEnd;
            const raw = v.currentTime;
            const segs = sortVideoSegments(videoTimelineSegments);

            if (segs.length > 1) {
              if (!v.paused) {
                for (let i = 0; i < segs.length - 1; i++) {
                  const a = segs[i];
                  const b = segs[i + 1];
                  if (raw >= a.endTime - 0.08 && raw < b.startTime) {
                    v.currentTime = b.startTime;
                    setCurrentTime(b.startTime);
                    return;
                  }
                }
              }
              const last = segs[segs.length - 1];
              const first = segs[0];
              if (hi > lo && !v.paused && raw + 1e-6 >= last.endTime) {
                v.pause();
                v.currentTime = first.startTime;
                setCurrentTime(first.startTime);
                setIsPlaying(false);
                return;
              }
            } else if (hi > lo && !v.paused && raw + 1e-6 >= hi) {
              v.pause();
              v.currentTime = lo;
              setCurrentTime(lo);
              setIsPlaying(false);
              return;
            }

            const t = clampVideoTime(raw);
            // Avoid tiny seeks at trim boundaries (decoder overshoot); those fired extra
            // `seeking` work and contributed to playback glitches.
            if (Math.abs(v.currentTime - t) > 0.04) {
              v.currentTime = t;
            }
            const activeSegment = videoSegments.find(
              (segment) => t >= segment.startTime && t < segment.endTime,
            );
            const globalAudioScale = originalAudioMuted ? 0 : originalAudioVolume / 100;
            if (activeSegment != null) {
              const segmentBase = activeSegment.isMuted ? 0 : activeSegment.volume / 100;
              let nextVolume = segmentBase;
              if (activeSegment.fadeIn > 0 && t < activeSegment.startTime + activeSegment.fadeIn) {
                const fadeFraction = (t - activeSegment.startTime) / activeSegment.fadeIn;
                nextVolume *= Math.max(0, Math.min(1, fadeFraction));
              }
              if (activeSegment.fadeOut > 0 && t > activeSegment.endTime - activeSegment.fadeOut) {
                const fadeFraction = (activeSegment.endTime - t) / activeSegment.fadeOut;
                nextVolume *= Math.max(0, Math.min(1, fadeFraction));
              }
              v.volume = Math.max(0, Math.min(1, nextVolume * globalAudioScale));
            } else {
              v.volume = Math.max(0, Math.min(1, globalAudioScale));
            }
            setCurrentTime(t);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        {frameReady &&
          imageLayers.map((layer, i) => (
            <ImageLayer key={layer.id} layer={layer} stackIndex={i} />
          ))}
        {frameReady &&
          blurLayers.map((layer, i) => (
            <BlurLayer key={layer.id} layer={layer} stackIndex={i} />
          ))}
        {frameReady &&
          visibleTextLayers.map((layer) => {
            const stackIndex = textLayers.findIndex((l) => l.id === layer.id);
            return (
              <TextLayer
                key={layer.id}
                layer={layer}
                stackIndex={stackIndex >= 0 ? stackIndex : 0}
              />
            );
          })}
        {isCropActive && frameReady ? (
          <CropOverlay
            videoWidth={frameSize.w}
            videoHeight={frameSize.h}
            videoSrc={videoSrc}
            mainVideoRef={videoRef}
          />
        ) : null}
      </div>
    </div>
  );
}
