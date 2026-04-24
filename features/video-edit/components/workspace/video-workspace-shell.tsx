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
import { SegmentAudioPanel } from '@/components/editor/panels/SegmentAudioPanel';
import { buildExportPayload, resolveExportVideoUrl } from '@/lib/buildExportPayload';
import { clampTimeToVideoSegments } from '@/lib/videoSegmentTime';
import { useAudioExtractor } from '@/hooks/useAudioExtractor';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import {
  exportVideoEditorWorkspace,
  getVideoEditorWorkspace,
  openVideoEditorWorkspaceSse,
  resetVideoEditorWorkspace,
  saveVideoEditorWorkspaceSnapshot,
  uploadVideoEditorFile,
} from '@/lib/video-editor-workspace-api';
import { triggerWorkspaceExportDownload } from '@/lib/video-editor-api';
import {
  MAIN_VIDEO_TIMELINE_CLIP_ID,
  useEditorStore,
  type EditorTool,
  type ImageLayer,
} from '@/store/editorStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { formatWorkspaceTime } from '@/features/video-edit/lib/format-workspace-time';
import { WorkspacePreviewCanvas, WORKSPACE_VIDEO_FILE_INPUT_ID } from './workspace-preview-canvas';
import {
  WorkspaceCanvasSizeGate,
  canvasAspectIdToEasyRatio,
  workspaceJsonHasPersistedVideo,
} from './workspace-canvas-size-gate';
import { WorkspacePropertiesPanel } from './workspace-properties-panel';
import { WorkspaceSubsPanel } from './workspace-subs-panel';
import { WorkspaceTimelineDock, type WorkspaceTimelinePhase } from './workspace-timeline-dock';
import { WorkspaceToolRail, type WorkspaceToolId } from './workspace-tool-rail';
import { WorkspaceTopBar, type WorkspaceAspectId } from './workspace-top-bar';

type WorkspaceHistorySnapshot = {
  videoSrc: string | null;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  trimApplyNonce: number;
  isPlaying: boolean;
  textLayers: ReturnType<typeof useEditorStore.getState>['textLayers'];
  blurLayers: ReturnType<typeof useEditorStore.getState>['blurLayers'];
  galleryImages: ReturnType<typeof useEditorStore.getState>['galleryImages'];
  imageLayers: ReturnType<typeof useEditorStore.getState>['imageLayers'];
  cropSettings: ReturnType<typeof useEditorStore.getState>['cropSettings'];
  isCropActive: boolean;
  playbackSpeed: number;
  selectedLayerId: string | null;
  selectedSegmentId: string | null;
  activeTool: EditorTool;
  audioTracks: ReturnType<typeof useEditorStore.getState>['audioTracks'];
  originalAudioMuted: boolean;
  originalAudioVolume: number;
  selectedAudioTrackId: string | null;
  videoTimelineSegments: ReturnType<typeof useEditorStore.getState>['videoTimelineSegments'];
  splitPoints: number[];
  videoSegments: ReturnType<typeof useEditorStore.getState>['videoSegments'];
};

function createWorkspaceHistorySnapshot(
  state: ReturnType<typeof useEditorStore.getState>,
): WorkspaceHistorySnapshot {
  return {
    videoSrc: state.videoSrc,
    duration: state.duration,
    currentTime: state.currentTime,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    trimApplyNonce: state.trimApplyNonce,
    isPlaying: state.isPlaying,
    textLayers: state.textLayers.map((item) => ({ ...item })),
    blurLayers: state.blurLayers.map((item) => ({ ...item })),
    galleryImages: state.galleryImages.map((item) => ({ ...item })),
    imageLayers: state.imageLayers.map((item) => ({ ...item })),
    cropSettings: {
      ...state.cropSettings,
      easyCrop: { ...state.cropSettings.easyCrop },
      croppedAreaPixels: state.cropSettings.croppedAreaPixels
        ? { ...state.cropSettings.croppedAreaPixels }
        : null,
      croppedAreaPercentages: state.cropSettings.croppedAreaPercentages
        ? { ...state.cropSettings.croppedAreaPercentages }
        : null,
    },
    isCropActive: state.isCropActive,
    playbackSpeed: state.playbackSpeed,
    selectedLayerId: state.selectedLayerId,
    selectedSegmentId: state.selectedSegmentId,
    activeTool: state.activeTool,
    audioTracks: state.audioTracks.map((item) => ({ ...item })),
    originalAudioMuted: state.originalAudioMuted,
    originalAudioVolume: state.originalAudioVolume,
    selectedAudioTrackId: state.selectedAudioTrackId,
    videoTimelineSegments: state.videoTimelineSegments.map((item) => ({ ...item })),
    splitPoints: [...state.splitPoints],
    videoSegments: state.videoSegments.map((item) => ({ ...item })),
  };
}

function snapshotSignature(snapshot: WorkspaceHistorySnapshot) {
  return JSON.stringify({
    ...snapshot,
    audioTracks: snapshot.audioTracks.map(({ audioBuffer, ...rest }) => ({
      ...rest,
      hasAudioBuffer: audioBuffer != null,
    })),
  });
}

function isBlobUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('blob:');
}

function extractWorkspaceKeyFromVideoSrc(value: string | null): string | null {
  if (value == null || value.trim() === '') return null;
  try {
    const u = new URL(value);
    const frag = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
    for (const token of frag.split('&')) {
      const [k, v] = token.split('=');
      if (k === 'wk' && v != null && v.trim() !== '') {
        return decodeURIComponent(v);
      }
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

function serializeWorkspaceForPersistence(state: ReturnType<typeof useEditorStore.getState>): string {
  const snapshot = createWorkspaceHistorySnapshot(state);
  const safeVideoSrc = isBlobUrl(snapshot.videoSrc) ? null : snapshot.videoSrc;
  const videoSrcKey = extractWorkspaceKeyFromVideoSrc(safeVideoSrc);
  const persistedVideoSrc = videoSrcKey != null ? null : safeVideoSrc;
  const safeGalleryImages = snapshot.galleryImages.filter((img) => !isBlobUrl(img.src));
  const safeGalleryIds = new Set(safeGalleryImages.map((img) => img.id));
  const safeImageLayers = snapshot.imageLayers.filter(
    (layer) => !isBlobUrl(layer.src) && safeGalleryIds.has(layer.galleryImageId),
  );
  const audioTracks = snapshot.audioTracks
    .filter((track) => !isBlobUrl(track.src))
    .map((track) => Object.fromEntries(Object.entries(track).filter(([key]) => key !== 'audioBuffer')));

  const hasVideo = persistedVideoSrc != null || videoSrcKey != null;
  return JSON.stringify({
    ...snapshot,
    videoSrc: persistedVideoSrc,
    videoSrcKey: videoSrcKey ?? undefined,
    duration: hasVideo ? snapshot.duration : 0,
    currentTime: hasVideo ? snapshot.currentTime : 0,
    trimStart: hasVideo ? snapshot.trimStart : 0,
    trimEnd: hasVideo ? snapshot.trimEnd : 0,
    videoTimelineSegments: hasVideo ? snapshot.videoTimelineSegments : [],
    splitPoints: hasVideo ? snapshot.splitPoints : [],
    videoSegments: hasVideo ? snapshot.videoSegments : [],
    galleryImages: safeGalleryImages,
    imageLayers: safeImageLayers,
    audioTracks,
  });
}

function parseWorkspaceFromPersistence(rawJson: string): WorkspaceHistorySnapshot | null {
  try {
    const raw = JSON.parse(rawJson) as WorkspaceHistorySnapshot & {
      audioTracks?: Array<Omit<WorkspaceHistorySnapshot['audioTracks'][number], 'audioBuffer'>>;
      videoSrcKey?: string;
    };
    if (raw == null || typeof raw !== 'object') return null;
    const base = createWorkspaceHistorySnapshot(useEditorStore.getState());
    const safeVideoSrc = isBlobUrl(raw.videoSrc) ? null : (raw.videoSrc ?? null);
    const safeGalleryImages = Array.isArray(raw.galleryImages)
      ? raw.galleryImages.filter((img) => !isBlobUrl(img.src))
      : base.galleryImages;
    const safeGalleryIds = new Set(safeGalleryImages.map((img) => img.id));
    const safeImageLayers = Array.isArray(raw.imageLayers)
      ? raw.imageLayers.filter((layer) => !isBlobUrl(layer.src) && safeGalleryIds.has(layer.galleryImageId))
      : base.imageLayers;
    const safeAudioTracks = Array.isArray(raw.audioTracks)
      ? raw.audioTracks
          .filter((track) => !isBlobUrl(track.src))
          .map((track) => ({ ...track, audioBuffer: null }))
      : base.audioTracks;
    const hasVideo =
      safeVideoSrc != null ||
      (typeof raw.videoSrcKey === 'string' && raw.videoSrcKey.trim().length > 0);
    return {
      ...base,
      ...raw,
      videoSrc: safeVideoSrc,
      duration: hasVideo ? raw.duration : 0,
      currentTime: hasVideo ? raw.currentTime : 0,
      trimStart: hasVideo ? raw.trimStart : 0,
      trimEnd: hasVideo ? raw.trimEnd : 0,
      videoTimelineSegments: hasVideo ? raw.videoTimelineSegments : [],
      splitPoints: hasVideo ? raw.splitPoints : [],
      videoSegments: hasVideo ? raw.videoSegments : [],
      galleryImages: safeGalleryImages,
      imageLayers: safeImageLayers,
      isPlaying: false,
      audioTracks: safeAudioTracks,
    };
  } catch {
    return null;
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}
type TimelineLaneItem = {
  id: string;
  startTime: number;
  endTime: number;
};

function aspectIdToRatio(aspect: WorkspaceAspectId): number {
  if (aspect === '16:9') return 16 / 9;
  if (aspect === '9:16') return 9 / 16;
  if (aspect === '1:1') return 1;
  return 4 / 3;
}

function ratioToAspectId(ratio: number): WorkspaceAspectId | null {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const ASPECTS: Array<{ id: WorkspaceAspectId; ratio: number }> = [
    { id: '16:9', ratio: 16 / 9 },
    { id: '9:16', ratio: 9 / 16 },
    { id: '1:1', ratio: 1 },
    { id: '4:3', ratio: 4 / 3 },
  ];
  const nearest = ASPECTS.reduce((best, next) =>
    Math.abs(next.ratio - ratio) < Math.abs(best.ratio - ratio) ? next : best,
  );
  return Math.abs(nearest.ratio - ratio) <= 0.01 ? nearest.id : null;
}

function assignWorkspaceTimelineVerticalLane(items: TimelineLaneItem[]) {
  const sorted = [...items].sort(
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

function assignWorkspaceImageTimelineVerticalLane(layers: ImageLayer[]) {
  return assignWorkspaceTimelineVerticalLane(layers);
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
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useEditorStore((s) => s.setSelectedSegmentId);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const selectedAudioTrackId = useEditorStore((s) => s.selectedAudioTrackId);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const originalAudioMuted = useEditorStore((s) => s.originalAudioMuted);
  const originalAudioVolume = useEditorStore((s) => s.originalAudioVolume);
  const setOriginalAudioMuted = useEditorStore((s) => s.setOriginalAudioMuted);
  const setOriginalAudioVolume = useEditorStore((s) => s.setOriginalAudioVolume);
  const cropEasyAspect = useEditorStore((s) => s.cropSettings.easyAspect);
  const setCropSettings = useEditorStore((s) => s.setCropSettings);

  useEffect(() => {
    return () => {
      setVideoSrc(null);
    };
  }, [setVideoSrc]);

  const [activeTool, setActiveTool] = useState<WorkspaceToolId>('media');
  const [font, setFont] = useState('inter');
  const [pos, setPos] = useState({ x: '810', y: '390', w: '300', h: '60' });
  const [opacity, setOpacity] = useState(100);
  const [timing, setTiming] = useState({ in: '0.0', out: '10.0' });
  const [clipRowById, setClipRowById] = useState<Record<string, string>>({});
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState('Connecting workspace stream...');
  const [workspaceUiPhase, setWorkspaceUiPhase] = useState<'loading' | 'canvas-only' | 'editor'>('loading');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const volumeBeforeMuteRef = useRef(72);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const historyPastRef = useRef<WorkspaceHistorySnapshot[]>([]);
  const historyFutureRef = useRef<WorkspaceHistorySnapshot[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const lastHistorySignatureRef = useRef('');
  const isHydratingWorkspaceRef = useRef(false);
  const pendingWorkspaceJsonRef = useRef<string | null>(null);
  const lastSyncedWorkspaceJsonRef = useRef<string>('');
  const workspaceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initial = createWorkspaceHistorySnapshot(useEditorStore.getState());
    historyPastRef.current = [initial];
    historyFutureRef.current = [];
    lastHistorySignatureRef.current = snapshotSignature(initial);
    setCanUndo(false);
    setCanRedo(false);

    const unsub = useEditorStore.subscribe((state) => {
      if (isApplyingHistoryRef.current) return;
      const next = createWorkspaceHistorySnapshot(state);
      const sig = snapshotSignature(next);
      if (sig === lastHistorySignatureRef.current) return;
      historyPastRef.current.push(next);
      if (historyPastRef.current.length > 100) {
        historyPastRef.current = historyPastRef.current.slice(-100);
      }
      historyFutureRef.current = [];
      lastHistorySignatureRef.current = sig;
      setCanUndo(historyPastRef.current.length > 1);
      setCanRedo(false);
    });

    return () => unsub();
  }, []);

  const aspect: WorkspaceAspectId = useMemo(
    () => ratioToAspectId(cropEasyAspect) ?? '16:9',
    [cropEasyAspect],
  );

  useEffect(() => {
    const closeSse = openVideoEditorWorkspaceSse({
      onStatus: (rawData) => {
        try {
          const status = JSON.parse(rawData) as { status?: string; message?: string; progressPercent?: number };
          if (status.message) {
            const percent = typeof status.progressPercent === 'number' ? ` (${Math.round(status.progressPercent)}%)` : '';
            setWorkspaceSyncStatus(`${status.message}${percent}`);
            return;
          }
          if (status.status) {
            setWorkspaceSyncStatus(`Workspace ${status.status}`);
            return;
          }
        } catch {
          // ignore non-json payload
        }
      },
      onError: (message) => {
        setWorkspaceSyncStatus(message);
      },
    });
    return () => closeSse();
  }, []);

  const applyHistorySnapshot = useCallback((snapshot: WorkspaceHistorySnapshot) => {
    isApplyingHistoryRef.current = true;
    useEditorStore.setState((state) => ({
      ...state,
      ...snapshot,
      isPlaying: false,
    }));
    const v = useEditorStore.getState().videoElement;
    if (v) {
      v.currentTime = snapshot.currentTime;
      v.pause();
    }
    isApplyingHistoryRef.current = false;
    lastHistorySignatureRef.current = snapshotSignature(snapshot);
    setCanUndo(historyPastRef.current.length > 1);
    setCanRedo(historyFutureRef.current.length > 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getVideoEditorWorkspace();
        if (cancelled) return;
        const rawWorkspaceJson =
          typeof result.workspaceJson === 'string' ? result.workspaceJson : '{}';
        const parsed = parseWorkspaceFromPersistence(rawWorkspaceJson);
        if (parsed != null) {
          isHydratingWorkspaceRef.current = true;
          applyHistorySnapshot(parsed);
          isHydratingWorkspaceRef.current = false;
          lastSyncedWorkspaceJsonRef.current = serializeWorkspaceForPersistence(useEditorStore.getState());
        }
        if (cancelled) return;
        setWorkspaceSyncStatus('Workspace loaded');
        setWorkspaceUiPhase(
          workspaceJsonHasPersistedVideo(rawWorkspaceJson) ? 'editor' : 'canvas-only',
        );
      } catch (error) {
        if (cancelled) return;
        setWorkspaceSyncStatus(
          error instanceof Error ? `Workspace load failed: ${error.message}` : 'Workspace load failed',
        );
        setWorkspaceUiPhase('canvas-only');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyHistorySnapshot]);

  useEffect(() => {
    const flushPending = async () => {
      const pendingJson = pendingWorkspaceJsonRef.current;
      if (!pendingJson || pendingJson === lastSyncedWorkspaceJsonRef.current) return;
      try {
        await saveVideoEditorWorkspaceSnapshot(pendingJson);
        lastSyncedWorkspaceJsonRef.current = pendingJson;
        setWorkspaceSyncStatus('Workspace cached');
      } catch (error) {
        setWorkspaceSyncStatus(
          error instanceof Error ? `Workspace sync failed: ${error.message}` : 'Workspace sync failed',
        );
      }
    };

    const unsubscribe = useEditorStore.subscribe((state) => {
      if (isHydratingWorkspaceRef.current) return;
      // Blob URLs are browser-local; serializing them becomes `videoSrc: null` and zeros duration,
      // which would overwrite the server snapshot while upload is still running. Wait for HTTPS + `#wk=`.
      if (typeof state.videoSrc === 'string' && state.videoSrc.startsWith('blob:')) {
        return;
      }
      const payload = serializeWorkspaceForPersistence(state);
      if (payload === lastSyncedWorkspaceJsonRef.current) return;
      pendingWorkspaceJsonRef.current = payload;
      setWorkspaceSyncStatus('Syncing workspace...');
      if (workspaceSaveTimerRef.current != null) {
        clearTimeout(workspaceSaveTimerRef.current);
      }
      workspaceSaveTimerRef.current = setTimeout(() => {
        void flushPending();
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (workspaceSaveTimerRef.current != null) {
        clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
    };
  }, []);

  const undo = useCallback(() => {
    if (historyPastRef.current.length <= 1) return;
    const current = historyPastRef.current.pop();
    if (!current) return;
    historyFutureRef.current.unshift(current);
    const prev = historyPastRef.current[historyPastRef.current.length - 1];
    if (!prev) return;
    applyHistorySnapshot(prev);
  }, [applyHistorySnapshot]);

  const redo = useCallback(() => {
    const next = historyFutureRef.current.shift();
    if (!next) return;
    historyPastRef.current.push(next);
    applyHistorySnapshot(next);
  }, [applyHistorySnapshot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        event.key.toLowerCase() === 'y' ||
        (event.key.toLowerCase() === 'z' && event.shiftKey)
      ) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    if (originalAudioVolume > 0) volumeBeforeMuteRef.current = originalAudioVolume;
  }, [originalAudioVolume]);

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
    if (!originalAudioMuted) {
      setOriginalAudioMuted(true);
    } else {
      setOriginalAudioMuted(false);
      setOriginalAudioVolume(
        volumeBeforeMuteRef.current > 0 ? volumeBeforeMuteRef.current : 72,
      );
    }
  }, [originalAudioMuted, setOriginalAudioMuted, setOriginalAudioVolume]);

  const onTogglePreviewFullscreen = useCallback(() => {
    const el = previewFrameRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      exitDocumentFullscreen();
    } else {
      requestElementFullscreen(el);
    }
  }, []);

  const onMusicFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        addAudioTrack('music', file);
        void uploadVideoEditorFile(file).catch((error) => {
          console.warn('[video-editor] music upload failed', error);
        });
      }
      e.target.value = '';
    },
    [addAudioTrack],
  );

  const onVoiceFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        addAudioTrack('voiceover', file);
        void uploadVideoEditorFile(file).catch((error) => {
          console.warn('[video-editor] voiceover upload failed', error);
        });
      }
      e.target.value = '';
    },
    [addAudioTrack],
  );

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
    setSelectedSegmentId(null);
    const v = videoElement;
    const next = useEditorStore.getState().currentTime;
    if (v) v.currentTime = next;
    setCurrentTime(next);
  }, [
    deleteVideoTimelineSegment,
    selectedLayerId,
    setCurrentTime,
    setSelectedSegmentId,
    videoElement,
    videoTimelineSegments,
  ]);

  const onTimelineClipSelect = useCallback(
    (clipId: string) => {
      const { videoTimelineSegments: segs, blurLayers: bl } = useEditorStore.getState();
      const isVideoClip =
        segs.some((s) => s.id === clipId) ||
        (segs.length === 0 && clipId === MAIN_VIDEO_TIMELINE_CLIP_ID);
      if (isVideoClip) {
        const timelineClip = segs.find((s) => s.id === clipId);
        const matchedVideoSegment = timelineClip
          ? useEditorStore
              .getState()
              .videoSegments.find(
                (segment) =>
                  Math.abs(segment.startTime - timelineClip.startTime) < 1e-4 &&
                  Math.abs(segment.endTime - timelineClip.endTime) < 1e-4,
              )
          : null;
        setSelectedSegmentId(matchedVideoSegment?.id ?? null);
        setSelectedLayerId(clipId);
        setSelectedAudioTrackId(null);
        setActiveTool('media');
        setActiveToolStore('pointer');
        return;
      }
      setSelectedSegmentId(null);
      setSelectedLayerId(clipId);
      if (bl.some((l) => l.id === clipId)) {
        setSelectedAudioTrackId(null);
        setActiveTool('blur');
        setActiveToolStore('blur');
        return;
      }
      const il = useEditorStore.getState().imageLayers;
      if (il.some((l) => l.id === clipId)) {
        setSelectedAudioTrackId(null);
        setActiveTool('image');
        setActiveToolStore('image');
        return;
      }
      setSelectedAudioTrackId(null);
      setActiveTool('text');
      setActiveToolStore('text');
    },
    [
      setActiveTool,
      setActiveToolStore,
      setSelectedAudioTrackId,
      setSelectedLayerId,
      setSelectedSegmentId,
    ],
  );

  const onTimelineAudioClipSelect = useCallback(
    (clipId: string) => {
      setSelectedLayerId(null);
      setSelectedSegmentId(null);
      setSelectedAudioTrackId(clipId);
      setActiveTool('audio');
      setActiveToolStore('audio');
    },
    [
      setActiveTool,
      setActiveToolStore,
      setSelectedAudioTrackId,
      setSelectedLayerId,
      setSelectedSegmentId,
    ],
  );

  const onTimelineClipMoveRow = useCallback((clipId: string, rowId: string) => {
    setClipRowById((prev) => (prev[clipId] === rowId ? prev : { ...prev, [clipId]: rowId }));
  }, []);

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
    const rows = ['video', 'text', 'blur', 'image', 'subtitle', 'audio'] as const;
    const bucket: Record<(typeof rows)[number], Array<any>> = {
      video: [],
      text: [],
      blur: [],
      image: [],
      subtitle: [],
      audio: [],
    };
    const place = (defaultRow: (typeof rows)[number], clip: any) => {
      const target = clipRowById[clip.id] as (typeof rows)[number] | undefined;
      const row = target != null && rows.includes(target) ? target : defaultRow;
      bucket[row].push(clip);
    };
    if (videoSrc && duration > 0) {
      const ordered =
        videoTimelineSegments.length > 0
          ? [...videoTimelineSegments].sort((a, b) => a.startTime - b.startTime)
          : [{ id: MAIN_VIDEO_TIMELINE_CLIP_ID, startTime: trimStart, endTime: trimEnd }];
      for (const s of ordered) {
        place('video', {
          id: s.id,
          kind: 'video' as const,
          label: t('timeline.clips.uploadedVideo'),
          start: s.startTime / duration,
          width: Math.max((s.endTime - s.startTime) / duration, 0.004),
          tone: 'violet' as const,
        });
      }
      const textLaneById = assignWorkspaceTimelineVerticalLane(
        textLayers.filter((x) => x.type === 'text'),
      );
      for (const l of textLayers.filter((x) => x.type === 'text')) {
        place('text', {
          id: l.id,
          kind: 'text' as const,
          label: (l.content.trim() || 'Text').slice(0, 32),
          start: l.startTime / duration,
          width: Math.max((l.endTime - l.startTime) / duration, 0.004),
          tone: 'emerald' as const,
          verticalLane: textLaneById.get(l.id) ?? 0,
        });
      }
      for (const l of blurLayers) {
        place('blur', {
          id: l.id,
          kind: 'blur' as const,
          label: 'Blur',
          start: l.startTime / duration,
          width: Math.max((l.endTime - l.startTime) / duration, 0.004),
          tone: 'rose' as const,
        });
      }
      const imageLaneById = assignWorkspaceImageTimelineVerticalLane(imageLayers);
      for (const l of imageLayers) {
        const meta = galleryImages.find((g) => g.id === l.galleryImageId);
        place('image', {
          id: l.id,
          kind: 'image' as const,
          label: (meta?.name ?? 'Image').slice(0, 32),
          start: l.startTime / duration,
          width: Math.max((l.endTime - l.startTime) / duration, 0.004),
          tone: 'amber' as const,
          thumbnailSrc: l.src,
          verticalLane: imageLaneById.get(l.id) ?? 0,
        });
      }
      for (const tAudio of audioTracks.filter((x) => x.type === 'music' || x.type === 'voiceover')) {
        place('audio', {
          id: tAudio.id,
          kind: 'audio' as const,
          label: tAudio.name.slice(0, 32),
          start: tAudio.startTime / duration,
          width: Math.max((tAudio.endTime - tAudio.startTime) / duration, 0.004),
          tone: 'sky' as const,
          audioType: tAudio.type,
        });
      }
    }
    return rows.map((id) => ({ id, clips: bucket[id] }));
  }, [audioTracks, blurLayers, clipRowById, duration, galleryImages, imageLayers, t, textLayers, trimEnd, trimStart, videoSrc, videoTimelineSegments]);

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
    selectedSegmentId != null ||
    (selectedLayerId != null && !selectedIsVideoTimelineClip);

  const panelMode: 'segment' | 'crop' | 'speed' | 'subs' | 'audio' | 'blur' | 'image' | 'text' | null =
    selectedSegmentId != null
      ? 'segment'
      : activeTool === 'crop'
        ? 'crop'
        : activeTool === 'speed'
          ? 'speed'
          : activeTool === 'subs'
            ? 'subs'
            : activeTool === 'audio'
              ? 'audio'
              : activeTool === 'blur'
                ? 'blur'
                : activeTool === 'image'
                  ? 'image'
                  : activeTool === 'text'
                    ? 'text'
                    : selectedIsBlur
                      ? 'blur'
                      : selectedIsImage
                        ? 'image'
                        : selectedLayerId != null
                          ? 'text'
                          : null;

  const onExportClick = useCallback(async () => {
    const state = useEditorStore.getState();
    if (resolveExportVideoUrl(state.videoSrc) == null) {
      setWorkspaceSyncStatus(
        state.videoSrc?.startsWith('blob:')
          ? 'Wait for the video to finish uploading before exporting.'
          : 'Add a video and ensure it is uploaded (not only a local preview) before exporting.',
      );
      return;
    }
    // Export must respect the top-bar aspect choice even if crop panel/workspace hydration
    // left `cropSettings.easyAspect` out of sync with the selected orientation.
    const payload = buildExportPayload({
      ...state,
      cropSettings: {
        ...state.cropSettings,
        easyAspect: aspectIdToRatio(aspect),
      },
    });
    setWorkspaceSyncStatus('Exporting video...');
    try {
      const result = await exportVideoEditorWorkspace(payload);
      setWorkspaceSyncStatus('Downloading export...');
      await triggerWorkspaceExportDownload(result.downloadUrl, result.s3Key);
      setWorkspaceSyncStatus('Export downloaded');
    } catch (error) {
      setWorkspaceSyncStatus(
        error instanceof Error ? `Export failed: ${error.message}` : 'Export failed',
      );
    }
  }, [aspect]);

  const performResetWorkspace = useCallback(async () => {
    setResetBusy(true);
    try {
      await resetVideoEditorWorkspace();
      setVideoSrc(null);
      setSelectedLayerId(null);
      setSelectedSegmentId(null);
      setSelectedAudioTrackId(null);
      setClipRowById({});
      setActiveTool('media');
      setActiveToolStore('pointer');
      const fresh = createWorkspaceHistorySnapshot(useEditorStore.getState());
      historyPastRef.current = [fresh];
      historyFutureRef.current = [];
      lastHistorySignatureRef.current = snapshotSignature(fresh);
      pendingWorkspaceJsonRef.current = null;
      lastSyncedWorkspaceJsonRef.current = '{}';
      setCanUndo(false);
      setCanRedo(false);
      setWorkspaceSyncStatus('Workspace reset');
      setWorkspaceUiPhase('canvas-only');
      setResetDialogOpen(false);
    } catch (error) {
      setWorkspaceSyncStatus(
        error instanceof Error ? `Workspace reset failed: ${error.message}` : 'Workspace reset failed',
      );
    } finally {
      setResetBusy(false);
    }
  }, [setActiveToolStore, setSelectedAudioTrackId, setSelectedLayerId, setSelectedSegmentId, setVideoSrc]);

  useEffect(() => {
    if (!resetDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setResetDialogOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetDialogOpen]);

  if (workspaceUiPhase === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-black text-foreground">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400"
          aria-hidden
        />
        <p className="mt-4 text-xs text-zinc-500">Loading workspace…</p>
      </div>
    );
  }

  if (workspaceUiPhase === 'canvas-only') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-black text-foreground">
        <WorkspaceCanvasSizeGate
          initialEasyAspect={cropEasyAspect}
          onContinue={(aspect) => {
            setCropSettings({ easyAspect: canvasAspectIdToEasyRatio(aspect) });
            setWorkspaceUiPhase('editor');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black text-foreground">
      <WorkspaceTopBar
        historyLabel={t('history')}
        exportLabel={t('exportVideo')}
        exportDisabled={resolveExportVideoUrl(videoSrc) == null}
        exportDisabledTitle={
          videoSrc?.startsWith('blob:')
            ? 'Wait for upload to finish'
            : videoSrc == null
              ? 'Add a video first'
              : 'Video must be available as an HTTPS URL for export'
        }
        resetLabel="Reset"
        onExportClick={onExportClick}
        onResetClick={() => setResetDialogOpen(true)}
        onUndoClick={undo}
        onRedoClick={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        syncStatusLabel={workspaceSyncStatus}
      />

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <WorkspaceToolRail tools={tools} activeTool={activeTool} onToolChange={handleToolChange} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <input
            ref={musicInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/x-aac,.mp3,.wav,.aac"
            className="sr-only"
            aria-hidden
            onChange={onMusicFile}
          />
          <input
            ref={voiceInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/x-aac,.mp3,.wav,.aac"
            className="sr-only"
            aria-hidden
            onChange={onVoiceFile}
          />
          <WorkspacePreviewCanvas
            ref={previewFrameRef}
            canvasLabel={t('canvasAria')}
            aspect={aspect}
            skipInitialCanvasSizeStep
          />
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
            volumeValue={originalAudioMuted ? 0 : originalAudioVolume}
            onVolumeChange={(value) => {
              setOriginalAudioVolume(value);
              if (value > 0 && originalAudioMuted) {
                setOriginalAudioMuted(false);
              }
            }}
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
            selectedAudioTrackId={selectedAudioTrackId}
            onTimelineDeselect={() => {
              setSelectedLayerId(null);
              setSelectedSegmentId(null);
              setSelectedAudioTrackId(null);
            }}
            onTimelineClipSelect={onTimelineClipSelect}
            onTimelineAudioClipSelect={onTimelineAudioClipSelect}
            onTimelineClipMoveRow={onTimelineClipMoveRow}
            trimToolActive={activeTool === 'trim'}
            splitAtPlayheadLabel={t('timeline.trim.splitAtPlayhead')}
            splitAtPlayheadAriaLabel={t('timeline.trim.splitAtPlayheadAria')}
            onSplitAtPlayhead={onSplitAtPlayhead}
            deleteSegmentLabel={t('timeline.trim.deleteSegment')}
            deleteSegmentAriaLabel={t('timeline.trim.deleteSegmentAria')}
            deleteSegmentEnabled={canDeleteSelectedVideoSegment}
            onDeleteVideoSegment={onDeleteSelectedVideoSegment}
            audioUploadVisible={activeTool === 'audio'}
            addMusicLabel="Add music"
            addVoiceoverLabel="Add voiceover"
            onAddMusic={() => musicInputRef.current?.click()}
            onAddVoiceover={() => voiceInputRef.current?.click()}
          />
        </div>
        {activeTool !== 'media' && activeTool !== 'trim' || selectedSegmentId != null ? (
          showStoreToolPanel ? (
            <aside className="flex max-h-[55vh] min-h-0 w-full shrink-0 flex-col border-t border-white/10 bg-black/70 xl:h-full xl:max-h-none xl:w-72 xl:min-w-72 xl:max-w-72 xl:border-l xl:border-t-0">
              <div className="shrink-0 border-b border-white/10 px-4 py-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {panelMode === 'segment'
                    ? 'Segment audio'
                    : panelMode === 'crop'
                      ? t('tools.crop')
                      : panelMode === 'speed'
                        ? t('tools.speed')
                        : panelMode === 'subs'
                          ? t('tools.subs')
                          : panelMode === 'audio'
                            ? t('tools.audio')
                            : panelMode === 'blur'
                              ? t('tools.blur')
                              : panelMode === 'image'
                                ? t('tools.image')
                                : t('tools.text')}
                </h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden text-foreground [scrollbar-gutter:stable]">
                {panelMode === 'segment' ? (
                  <SegmentAudioPanel />
                ) : panelMode === 'crop' ? (
                  <CropProperties onAfterApply={() => setActiveTool('media')} />
                ) : panelMode === 'speed' ? (
                  <SpeedProperties />
                ) : panelMode === 'subs' ? (
                  <WorkspaceSubsPanel
                    onImported={() => {
                      setActiveTool('text');
                      setActiveToolStore('text');
                    }}
                  />
                ) : panelMode === 'audio' ? (
                  <AudioProperties />
                ) : panelMode === 'blur' ? (
                  <BlurProperties />
                ) : panelMode === 'image' ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
                    {activeTool === 'image' ? (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <ImageGalleryPanel developerSourceOnly />
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
          )
        ) : null}
      </div>

      {resetDialogOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            aria-label={t('resetDialog.cancel')}
            onClick={() => !resetBusy && setResetDialogOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-reset-title"
            aria-describedby="workspace-reset-desc"
            className="relative z-[101] w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/60 sm:p-6"
          >
            <h2 id="workspace-reset-title" className="text-lg font-semibold tracking-tight text-white">
              {t('resetDialog.title')}
            </h2>
            <p id="workspace-reset-desc" className="mt-2 text-sm leading-relaxed text-zinc-400">
              {t('resetDialog.description')}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => setResetDialogOpen(false)}
                className="rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
              >
                {t('resetDialog.cancel')}
              </button>
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => void performResetWorkspace()}
                className="rounded-xl border border-rose-500/40 bg-rose-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/40 transition hover:bg-rose-500 disabled:opacity-60"
              >
                {resetBusy ? t('resetDialog.resetting') : t('resetDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
