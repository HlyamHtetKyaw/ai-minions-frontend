'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AudioProperties } from '@/components/editor/panels/AudioProperties';
import { BlurProperties } from '@/components/editor/panels/BlurProperties';
import { CropProperties } from '@/components/editor/panels/CropProperties';
import { SpeedProperties } from '@/components/editor/panels/SpeedProperties';
import { TextProperties } from '@/components/editor/panels/TextProperties';
import { ImageGalleryPanel } from '@/components/editor/panels/ImageGalleryPanel';
import { ImageProperties } from '@/components/editor/panels/ImageProperties';
import { buildExportPayload } from '@/lib/buildExportPayload';
import { clampTimeToVideoSegments } from '@/lib/videoSegmentTime';
import { useAudioExtractor } from '@/hooks/useAudioExtractor';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import {
  MAIN_VIDEO_TIMELINE_CLIP_ID,
  useEditorStore,
  type EditorTool,
  type ImageLayer,
} from '@/store/editorStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { formatWorkspaceTime } from '@/features/video-edit/lib/format-workspace-time';
import { WorkspacePreviewCanvas, WORKSPACE_VIDEO_FILE_INPUT_ID } from './workspace-preview-canvas';
import { WorkspacePropertiesPanel } from './workspace-properties-panel';
import { WorkspaceSubsPanel } from './workspace-subs-panel';
import { WorkspaceTimelineDock, type WorkspaceTimelinePhase } from './workspace-timeline-dock';
import { WorkspaceToolRail, type WorkspaceToolId } from './workspace-tool-rail';
import { WorkspaceTopBar, type WorkspaceAspectId } from './workspace-top-bar';
function assignWorkspaceImageTimelineVerticalLane(layers: ImageLayer[]) {
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

const STORE_TOOL_BY_WORKSPACE: Record<WorkspaceToolId, EditorTool> = {
  media: 'pointer',
  text: 'text',
  blur: 'blur',
  image: 'image',
  crop: 'crop',
  speed: 'speed',
  subs: 'pointer',
  audio: 'audio',
  trim: 'trim',
};

function getFullscreenElement(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function exitDocumentFullscreen(): void {
  const d = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
  void (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
}

function requestElementFullscreen(el: HTMLElement): void {
  const node = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  void (el.requestFullscreen?.() ?? node.webkitRequestFullscreen?.());
}

export function VideoWorkspaceShell() {
  useKeyboardShortcuts();
  useAudioExtractor();
  useAudioPlayback();

  const t = useTranslations('video-edit.workspace');

  const videoSrc = useEditorStore((s) => s.videoSrc);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const videoElement = useEditorStore((s) => s.videoElement);
  const textLayers = useEditorStore((s) => s.textLayers);
  const blurLayers = useEditorStore((s) => s.blurLayers);
  const imageLayers = useEditorStore((s) => s.imageLayers);
  const galleryImages = useEditorStore((s) => s.galleryImages);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useEditorStore((s) => s.setPlaybackSpeed);
  const trimStart = useEditorStore((s) => s.trimStart);
  const trimEnd = useEditorStore((s) => s.trimEnd);
  const videoTimelineSegments = useEditorStore((s) => s.videoTimelineSegments);
  const splitVideoAtPlayhead = useEditorStore((s) => s.splitVideoAtPlayhead);
  const deleteVideoTimelineSegment = useEditorStore((s) => s.deleteVideoTimelineSegment);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setVideoSrc = useEditorStore((s) => s.setVideoSrc);
  const setActiveToolStore = useEditorStore((s) => s.setActiveTool);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  useEffect(() => {
    return () => {
      setVideoSrc(null);
    };
  }, [setVideoSrc]);

  const [aspect, setAspect] = useState<WorkspaceAspectId>('16:9');
  const [activeTool, setActiveTool] = useState<WorkspaceToolId>('media');
  const [font, setFont] = useState('inter');
  const [pos, setPos] = useState({ x: '810', y: '390', w: '300', h: '60' });
  const [opacity, setOpacity] = useState(100);
  const [timing, setTiming] = useState({ in: '0.0', out: '10.0' });
  const [volume, setVolume] = useState(72);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const volumeBeforeMuteRef = useRef(72);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  useEffect(() => {
    if (volume > 0) volumeBeforeMuteRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const sync = () => {
      setPreviewFullscreen(getFullscreenElement() === previewFrameRef.current);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const onToggleMute = useCallback(() => {
    if (volume > 0) {
      setVolume(0);
    } else {
      setVolume(volumeBeforeMuteRef.current > 0 ? volumeBeforeMuteRef.current : 72);
    }
  }, [volume]);

  const onTogglePreviewFullscreen = useCallback(() => {
    const el = previewFrameRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      exitDocumentFullscreen();
    } else {
      requestElementFullscreen(el);
    }
  }, []);

  const handleToolChange = useCallback(
    (id: WorkspaceToolId) => {
      setActiveTool(id);
      setActiveToolStore(STORE_TOOL_BY_WORKSPACE[id]);
      if (id === 'media') {
        queueMicrotask(() => {
          document.getElementById(WORKSPACE_VIDEO_FILE_INPUT_ID)?.click();
        });
      }
    },
    [setActiveTool, setActiveToolStore],
  );

  useEffect(() => {
    if (!videoElement) return;
    videoElement.volume = volume / 100;
  }, [videoElement, volume]);

  const onTogglePlay = useCallback(() => {
    const v = videoElement;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {
        /* Ignore AbortError / "interrupted by pause" races */
      });
    } else {
      v.pause();
    }
  }, [videoElement]);

  const onPrev = useCallback(() => {
    const v = videoElement;
    if (!v || duration <= 0) return;
    const { trimStart, trimEnd, videoTimelineSegments: vts } = useEditorStore.getState();
    const lo = trimEnd > trimStart ? trimStart : 0;
    const hi = trimEnd > trimStart ? trimEnd : duration;
    let next = Math.min(Math.max(lo, v.currentTime - 5), hi);
    if (vts.length > 1) {
      next = clampTimeToVideoSegments(next, vts, duration);
    }
    v.currentTime = next;
    setCurrentTime(next);
  }, [videoElement, duration, setCurrentTime]);

  const onNext = useCallback(() => {
    const v = videoElement;
    if (!v || duration <= 0) return;
    const { trimStart, trimEnd, videoTimelineSegments: vts } = useEditorStore.getState();
    const lo = trimEnd > trimStart ? trimStart : 0;
    const hi = trimEnd > trimStart ? trimEnd : duration;
    let next = Math.min(Math.max(lo, v.currentTime + 5), hi);
    if (vts.length > 1) {
      next = clampTimeToVideoSegments(next, vts, duration);
    }
    v.currentTime = next;
    setCurrentTime(next);
  }, [videoElement, duration, setCurrentTime]);

  const onSeekRatio = useCallback(
    (ratio: number) => {
      const v = videoElement;
      if (!v || duration <= 0) return;
      const { trimStart, trimEnd, videoTimelineSegments: vts } = useEditorStore.getState();
      const raw = Math.min(duration, Math.max(0, ratio * duration));
      let next =
        vts.length > 1
          ? clampTimeToVideoSegments(raw, vts, duration)
          : trimEnd > trimStart
            ? Math.min(Math.max(raw, trimStart), trimEnd)
            : raw;
      v.currentTime = next;
      setCurrentTime(next);
    },
    [videoElement, duration, setCurrentTime],
  );

  const onSplitAtPlayhead = useCallback(() => {
    splitVideoAtPlayhead();
    const v = videoElement;
    const next = useEditorStore.getState().currentTime;
    if (v) v.currentTime = next;
    setCurrentTime(next);
  }, [splitVideoAtPlayhead, setCurrentTime, videoElement]);

  const canDeleteSelectedVideoSegment =
    activeTool === 'trim' &&
    selectedLayerId != null &&
    videoTimelineSegments.length > 1 &&
    videoTimelineSegments.some((s) => s.id === selectedLayerId);

  const onDeleteSelectedVideoSegment = useCallback(() => {
    const sid = selectedLayerId;
    if (sid == null || videoTimelineSegments.length <= 1) return;
    if (!videoTimelineSegments.some((s) => s.id === sid)) return;
    deleteVideoTimelineSegment(sid);
    setSelectedLayerId(null);
    const v = videoElement;
    const next = useEditorStore.getState().currentTime;
    if (v) v.currentTime = next;
    setCurrentTime(next);
  }, [
    deleteVideoTimelineSegment,
    selectedLayerId,
    setCurrentTime,
    setSelectedLayerId,
    videoElement,
    videoTimelineSegments,
  ]);

  const onTimelineClipSelect = useCallback(
    (clipId: string) => {
      setSelectedLayerId(clipId);
      const { videoTimelineSegments: segs, blurLayers: bl } = useEditorStore.getState();
      const isVideoClip =
        segs.some((s) => s.id === clipId) ||
        (segs.length === 0 && clipId === MAIN_VIDEO_TIMELINE_CLIP_ID);
      if (isVideoClip) {
        setActiveTool('media');
        setActiveToolStore('pointer');
        return;
      }
      if (bl.some((l) => l.id === clipId)) {
        setActiveTool('blur');
        setActiveToolStore('blur');
        return;
      }
      const il = useEditorStore.getState().imageLayers;
      if (il.some((l) => l.id === clipId)) {
        setActiveTool('image');
        setActiveToolStore('image');
        return;
      }
      setActiveTool('text');
      setActiveToolStore('text');
    },
    [setActiveTool, setActiveToolStore, setSelectedLayerId],
  );

  const aspectOptions = useMemo(
    () =>
      [
        { id: '16:9' as const, label: t('aspect.ratio16_9') },
        { id: '9:16' as const, label: t('aspect.ratio9_16') },
        { id: '1:1' as const, label: t('aspect.ratio1_1') },
        { id: '4:3' as const, label: t('aspect.ratio4_3') },
      ],
    [t],
  );

  const tools = useMemo(
    () =>
      [
        { id: 'media' as const, label: t('tools.media') },
        { id: 'text' as const, label: t('tools.text') },
        { id: 'blur' as const, label: t('tools.blur') },
        { id: 'image' as const, label: t('tools.image') },
        { id: 'crop' as const, label: t('tools.crop') },
        { id: 'speed' as const, label: t('tools.speed') },
        { id: 'subs' as const, label: t('tools.subs') },
        { id: 'trim' as const, label: t('tools.trim') },
        { id: 'audio' as const, label: t('tools.audio') },
      ],
    [t],
  );

  const tracks = useMemo(() => {
    const videoClips =
      videoSrc && duration > 0
        ? (() => {
            const ordered =
              videoTimelineSegments.length > 0
                ? [...videoTimelineSegments].sort((a, b) => a.startTime - b.startTime)
                : [
                    {
                      id: MAIN_VIDEO_TIMELINE_CLIP_ID,
                      startTime: trimStart,
                      endTime: trimEnd,
                    },
                  ];
            return ordered.map((s) => ({
              id: s.id,
              label: t('timeline.clips.uploadedVideo'),
              start: s.startTime / duration,
              width: Math.max((s.endTime - s.startTime) / duration, 0.004),
              tone: 'violet' as const,
            }));
          })()
        : [];
    const textClips =
      videoSrc && duration > 0
        ? textLayers
            .filter((l) => l.type === 'text')
            .map((l) => ({
              id: l.id,
              label: (l.content.trim() || 'Text').slice(0, 32),
              start: l.startTime / duration,
              width: Math.max((l.endTime - l.startTime) / duration, 0.004),
              tone: 'emerald' as const,
            }))
        : [];
    const blurClips =
      videoSrc && duration > 0
        ? blurLayers.map((l) => ({
            id: l.id,
            label: 'Blur',
            start: l.startTime / duration,
            width: Math.max((l.endTime - l.startTime) / duration, 0.004),
            tone: 'rose' as const,
          }))
        : [];
    const imageLaneById = assignWorkspaceImageTimelineVerticalLane(imageLayers);
    const imageClips =
      videoSrc && duration > 0
        ? imageLayers.map((l) => {
            const meta = galleryImages.find((g) => g.id === l.galleryImageId);
            return {
              id: l.id,
              label: (meta?.name ?? 'Image').slice(0, 32),
              start: l.startTime / duration,
              width: Math.max((l.endTime - l.startTime) / duration, 0.004),
              tone: 'amber' as const,
              thumbnailSrc: l.src,
              verticalLane: imageLaneById.get(l.id) ?? 0,
            };
          })
        : [];
    return [
      { id: 'video', clips: videoClips },
      { id: 'text', clips: textClips },
      { id: 'blur', clips: blurClips },
      { id: 'image', clips: imageClips },
      { id: 'subtitle', clips: [] },
      { id: 'audio', clips: [] },
    ];
  }, [
    blurLayers,
    duration,
    galleryImages,
    imageLayers,
    textLayers,
    t,
    trimEnd,
    trimStart,
    videoSrc,
    videoTimelineSegments,
  ]);

  const timeDisplay = t('timeAtPlayhead', {
    current: formatWorkspaceTime(currentTime),
    total: formatWorkspaceTime(duration),
  });

  const playheadPosition = duration > 0 ? currentTime / duration : 0;

  const timelinePhase: WorkspaceTimelinePhase = !videoSrc
    ? 'no-media'
    : duration <= 0
      ? 'loading'
      : 'ready';

  const selectedIsBlur = useMemo(
    () =>
      selectedLayerId != null && blurLayers.some((l) => l.id === selectedLayerId),
    [blurLayers, selectedLayerId],
  );

  const selectedIsImage = useMemo(
    () =>
      selectedLayerId != null && imageLayers.some((l) => l.id === selectedLayerId),
    [imageLayers, selectedLayerId],
  );

  const selectedIsVideoTimelineClip =
    selectedLayerId != null &&
    (videoTimelineSegments.some((s) => s.id === selectedLayerId) ||
      (videoTimelineSegments.length === 0 && selectedLayerId === MAIN_VIDEO_TIMELINE_CLIP_ID));

  const showStoreToolPanel =
    activeTool === 'text' ||
    activeTool === 'blur' ||
    activeTool === 'image' ||
    activeTool === 'crop' ||
    activeTool === 'speed' ||
    activeTool === 'subs' ||
    activeTool === 'audio' ||
    (selectedLayerId != null && !selectedIsVideoTimelineClip);

  const onExportClick = useCallback(() => {
    const payload = buildExportPayload(useEditorStore.getState());
    console.info('[workspace] export payload', payload);
  }, []);

  return (
    <div className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black text-foreground">
      <WorkspaceTopBar
        returnToDashboardLabel={t('returnToDashboard')}
        aspect={aspect}
        onAspectChange={setAspect}
        aspectOptions={aspectOptions}
        aspectToggleAriaLabel={t('aspectToggleAria')}
        exportLabel={t('exportVideo')}
        onExportClick={onExportClick}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <WorkspaceToolRail tools={tools} activeTool={activeTool} onToolChange={handleToolChange} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <WorkspacePreviewCanvas ref={previewFrameRef} canvasLabel={t('canvasAria')} />
          <WorkspaceTimelineDock
            phase={timelinePhase}
            durationSec={duration}
            playheadPosition={playheadPosition}
            timeDisplay={timeDisplay}
            emptyLabel={t('timeline.emptyUpload')}
            loadingLabel={t('timeline.preparing')}
            tracks={tracks}
            playbackPrevLabel={t('playback.prev')}
            playbackNextLabel={t('playback.next')}
            playbackPlayLabel={t('playback.play')}
            playbackPauseLabel={t('playback.pause')}
            speedLabel={t('playback.speed')}
            speedAriaLabel={t('playback.speedAria')}
            speedValue={String(playbackSpeed)}
            onSpeedChange={(v) => {
              const n = Number.parseFloat(v);
              if (Number.isFinite(n) && n > 0) setPlaybackSpeed(n);
            }}
            volumeLabel={t('playback.volume')}
            volumeValue={volume}
            onVolumeChange={setVolume}
            muteLabel={t('playback.mute')}
            unmuteLabel={t('playback.unmute')}
            fullscreenEnterLabel={t('playback.fullscreenEnter')}
            fullscreenExitLabel={t('playback.fullscreenExit')}
            isFullscreen={previewFullscreen}
            onToggleFullscreen={onTogglePreviewFullscreen}
            onToggleMute={onToggleMute}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onPrev={onPrev}
            onNext={onNext}
            onSeekRatio={onSeekRatio}
            selectedTimelineClipId={selectedLayerId}
            onTimelineDeselect={() => setSelectedLayerId(null)}
            onTimelineClipSelect={onTimelineClipSelect}
            trimToolActive={activeTool === 'trim'}
            splitAtPlayheadLabel={t('timeline.trim.splitAtPlayhead')}
            splitAtPlayheadAriaLabel={t('timeline.trim.splitAtPlayheadAria')}
            onSplitAtPlayhead={onSplitAtPlayhead}
            deleteSegmentLabel={t('timeline.trim.deleteSegment')}
            deleteSegmentAriaLabel={t('timeline.trim.deleteSegmentAria')}
            deleteSegmentEnabled={canDeleteSelectedVideoSegment}
            onDeleteVideoSegment={onDeleteSelectedVideoSegment}
          />
        </div>
        {showStoreToolPanel ? (
          <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-l border-white/10 bg-black/70 md:w-72 md:min-w-72 md:max-w-72">
            <div className="shrink-0 border-b border-white/10 px-4 py-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {activeTool === 'crop'
                  ? t('tools.crop')
                  : activeTool === 'speed'
                    ? t('tools.speed')
                    : activeTool === 'subs'
                      ? t('tools.subs')
                      : activeTool === 'audio'
                        ? t('tools.audio')
                        : activeTool === 'blur' || selectedIsBlur
                          ? t('tools.blur')
                          : activeTool === 'image' || selectedIsImage
                            ? t('tools.image')
                            : t('tools.text')}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden text-foreground [scrollbar-gutter:stable]">
              {activeTool === 'crop' ? (
                <CropProperties onAfterApply={() => setActiveTool('media')} />
              ) : activeTool === 'speed' ? (
                <SpeedProperties />
              ) : activeTool === 'subs' ? (
                <WorkspaceSubsPanel
                  onImported={() => {
                    setActiveTool('text');
                    setActiveToolStore('text');
                  }}
                />
              ) : activeTool === 'audio' ? (
                <AudioProperties />
              ) : activeTool === 'blur' || selectedIsBlur ? (
                <BlurProperties />
              ) : activeTool === 'image' || selectedIsImage ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
                  {activeTool === 'image' ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <ImageGalleryPanel />
                    </div>
                  ) : null}
                  {selectedIsImage ? (
                    <div className="min-h-0 shrink-0 overflow-y-auto">
                      <ImageProperties />
                    </div>
                  ) : activeTool === 'image' ? (
                    <p className="shrink-0 text-xs leading-relaxed text-muted">
                      Drag a thumbnail onto the video preview, click + to add, or select an image clip
                      on the timeline.
                    </p>
                  ) : null}
                </div>
              ) : (
                <TextProperties />
              )}
            </div>
          </aside>
        ) : (
          <WorkspacePropertiesPanel
            titleLabel={t('tabs.properties')}
            fontLabel={t('font')}
            fontValue={font}
            onFontChange={setFont}
            positionSectionLabel={t('position')}
            x={pos.x}
            y={pos.y}
            w={pos.w}
            h={pos.h}
            onPositionChange={(key, v) => setPos((p) => ({ ...p, [key]: v }))}
            opacityLabel={t('opacity')}
            opacityPct={opacity}
            onOpacityChange={setOpacity}
            timingSectionLabel={t('timing')}
            inLabel={t('timeIn')}
            outLabel={t('timeOut')}
            timeIn={timing.in}
            timeOut={timing.out}
            onTimingChange={(key, v) => setTiming((x) => ({ ...x, [key]: v }))}
            deleteLabel={t('deleteLayer')}
          />
        )}
      </div>
    </div>
  );
}
