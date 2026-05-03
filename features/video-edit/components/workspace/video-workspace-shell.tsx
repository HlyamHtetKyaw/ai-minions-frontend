'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AudioProperties } from '@/components/editor/panels/AudioProperties';
import { BlurProperties } from '@/components/editor/panels/BlurProperties';
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
import { videoEditorExportEstimateExisting } from '@/lib/video-editor-api';
import { fetchMe } from '@/lib/auth';
import { openGenerationJobSseStream, parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';
import {
  MAIN_VIDEO_TIMELINE_CLIP_ID,
  useEditorStore,
  type EditorTool,
  type ImageLayer,
} from '@/store/editorStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { formatWorkspaceTime } from '@/features/video-edit/lib/format-workspace-time';
import {
  createWorkspaceHistorySnapshot,
  extractWorkspaceKeyFromVideoSrc,
  parseWorkspaceFromPersistence,
  serializeWorkspaceForPersistence,
  snapshotSignature,
  withWorkspaceObjectKey,
  type WorkspaceHistorySnapshot,
} from '@/features/video-edit/lib/workspace-editor-persistence';
import { WorkspacePreviewCanvas, WORKSPACE_VIDEO_FILE_INPUT_ID } from './workspace-preview-canvas';
import type { WorkspacePreviewFrameFill } from './workspace-preview-frame-style';
import { workspaceJsonHasPersistedVideo } from './workspace-canvas-size-gate';
import { WorkspacePropertiesPanel } from './workspace-properties-panel';
import { WorkspaceSubsPanel } from './workspace-subs-panel';
import { WorkspaceTimelineDock, type WorkspaceTimelinePhase } from './workspace-timeline-dock';
import { WorkspaceToolRail, type WorkspaceToolId } from './workspace-tool-rail';
import { WorkspaceTopBar, type WorkspaceAspectId } from './workspace-top-bar';

const TIMELINE_DOCK_HEIGHT_STORAGE_KEY = 'ai-minions.video-workspace.timelineDockHeightPx';
const TIMELINE_DOCK_HEIGHT_DEFAULT = 268;
const TIMELINE_DOCK_MIN_PX = 140;
const PREVIEW_PANEL_MIN_HEIGHT_PX = 260;
const PREVIEW_PANEL_MIN_HEIGHT_MOBILE_PX = 180;
/** Must match center column `gap-8` (2rem); two gaps between preview, separator, and timeline. */
const WORKSPACE_CENTER_COLUMN_GAP_PX = 32;
const EXPORT_AUDIO_ESTIMATE_BITRATE_BPS = 160_000;
const EXPORT_VIDEO_LENGTH_POINT_PER_MIN = 1;

function readStoredTimelineDockHeightPx(): number {
  if (typeof window === 'undefined') return TIMELINE_DOCK_HEIGHT_DEFAULT;
  const storedMax = Math.min(900, Math.max(240, Math.floor(window.innerHeight * 0.62)));
  try {
    const raw = localStorage.getItem(TIMELINE_DOCK_HEIGHT_STORAGE_KEY);
    const n = raw != null ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= TIMELINE_DOCK_MIN_PX && n <= storedMax) return n;
  } catch {
    /* ignore */
  }
  return TIMELINE_DOCK_HEIGHT_DEFAULT;
}

function getPreviewPanelMinHeightPx(): number {
  if (typeof window === 'undefined') return PREVIEW_PANEL_MIN_HEIGHT_PX;
  return window.matchMedia('(max-width: 639px)').matches
    ? PREVIEW_PANEL_MIN_HEIGHT_MOBILE_PX
    : PREVIEW_PANEL_MIN_HEIGHT_PX;
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

  const router = useRouter();
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
  const trimHeadToPlayhead = useEditorStore((s) => s.trimHeadToPlayhead);
  const trimTailToPlayhead = useEditorStore((s) => s.trimTailToPlayhead);
  const deleteVideoTimelineSegmentAtPlayhead = useEditorStore(
    (s) => s.deleteVideoTimelineSegmentAtPlayhead,
  );
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
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);
  const originalAudioMuted = useEditorStore((s) => s.originalAudioMuted);
  const originalAudioVolume = useEditorStore((s) => s.originalAudioVolume);
  const setOriginalAudioMuted = useEditorStore((s) => s.setOriginalAudioMuted);
  const setOriginalAudioVolume = useEditorStore((s) => s.setOriginalAudioVolume);
  const cropEasyAspect = useEditorStore((s) => s.cropSettings.easyAspect);

  useEffect(() => {
    return () => {
      setVideoSrc(null);
    };
  }, [setVideoSrc]);

  const [activeTool, setActiveTool] = useState<WorkspaceToolId>('media');
  const [pos, setPos] = useState({ x: '810', y: '390', w: '300', h: '60' });
  const [opacity, setOpacity] = useState(100);
  const [timing, setTiming] = useState({ in: '0.0', out: '10.0' });
  const [clipRowById, setClipRowById] = useState<Record<string, string>>({});
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState('Connecting workspace stream...');
  const [workspaceUiPhase, setWorkspaceUiPhase] = useState<'loading' | 'editor'>('loading');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [exportOverlayPhase, setExportOverlayPhase] = useState<'idle' | 'exporting' | 'downloading'>('idle');
  const [exportProgressPercent, setExportProgressPercent] = useState(0);
  const [exportProgressMessage, setExportProgressMessage] = useState('');
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exportEstimateLoading, setExportEstimateLoading] = useState(false);
  const [exportEstimateError, setExportEstimateError] = useState<string | null>(null);
  const [exportEstimatedPoints, setExportEstimatedPoints] = useState<number>(0);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [exportEstimateBreakdown, setExportEstimateBreakdown] = useState<{
    mbVideo: number;
    mbAudio: number;
    videoLengthSec: number;
    fromServerReservePoints: number;
    addedAudioPoints: number;
    addedLengthPoints: number;
  } | null>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const exportOverlayPhaseRef = useRef<'idle' | 'exporting' | 'downloading'>('idle');
  const volumeBeforeMuteRef = useRef(72);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const historyPastRef = useRef<WorkspaceHistorySnapshot[]>([]);
  const historyFutureRef = useRef<WorkspaceHistorySnapshot[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const lastHistorySignatureRef = useRef('');
  const isHydratingWorkspaceRef = useRef(false);
  const pendingWorkspaceJsonRef = useRef<string | null>(null);
  const lastSyncedWorkspaceJsonRef = useRef<string>('');
  const workspaceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerColumnRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const timelineSeparatorRef = useRef<HTMLDivElement>(null);
  const [previewPaneSize, setPreviewPaneSize] = useState<WorkspacePreviewFrameFill>({ widthPx: 0, heightPx: 0 });
  const [timelineDockHeightPx, setTimelineDockHeightPx] = useState(readStoredTimelineDockHeightPx);
  const timelineDockHeightPxRef = useRef(timelineDockHeightPx);
  timelineDockHeightPxRef.current = timelineDockHeightPx;
  useEffect(() => {
    exportOverlayPhaseRef.current = exportOverlayPhase;
  }, [exportOverlayPhase]);

  const readTimelineResizeBounds = useCallback(() => {
    const col = centerColumnRef.current;
    const sepH = timelineSeparatorRef.current?.offsetHeight ?? 12;
    const gapTotal = WORKSPACE_CENTER_COLUMN_GAP_PX * 2;
    const previewMin = getPreviewPanelMinHeightPx();
    if (!col) {
      return { min: TIMELINE_DOCK_MIN_PX, max: 560 };
    }
    const ch = col.clientHeight;
    const rawMax = Math.floor(ch - sepH - gapTotal - previewMin);
    const min = TIMELINE_DOCK_MIN_PX;
    return { min, max: Math.max(min, rawMax) };
  }, []);

  const onTimelineDockResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startH = timelineDockHeightPxRef.current;
      const pointerId = e.pointerId;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const { min, max } = readTimelineResizeBounds();
        const delta = startY - ev.clientY;
        const next = Math.min(max, Math.max(min, startH + delta));
        timelineDockHeightPxRef.current = next;
        setTimelineDockHeightPx(next);
      };

      const finish = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        try {
          localStorage.setItem(TIMELINE_DOCK_HEIGHT_STORAGE_KEY, String(timelineDockHeightPxRef.current));
        } catch {
          /* ignore quota / private mode */
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [readTimelineResizeBounds],
  );

  useEffect(() => {
    const clampToColumn = () => {
      const { min, max } = readTimelineResizeBounds();
      setTimelineDockHeightPx((h) => {
        const next = Math.min(Math.max(min, h), max);
        if (next !== h) {
          try {
            localStorage.setItem(TIMELINE_DOCK_HEIGHT_STORAGE_KEY, String(next));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    };
    window.addEventListener('resize', clampToColumn);
    window.addEventListener('orientationchange', clampToColumn);
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    vv?.addEventListener('resize', clampToColumn);
    vv?.addEventListener('scroll', clampToColumn);
    const raf = requestAnimationFrame(() => clampToColumn());
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', clampToColumn);
      window.removeEventListener('orientationchange', clampToColumn);
      vv?.removeEventListener('resize', clampToColumn);
      vv?.removeEventListener('scroll', clampToColumn);
    };
  }, [readTimelineResizeBounds]);

  useLayoutEffect(() => {
    if (previewFullscreen) return;
    const el = previewPaneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const widthPx = Math.max(0, Math.floor(cr.width));
      const heightPx = Math.max(0, Math.floor(cr.height));
      setPreviewPaneSize((prev) =>
        prev.widthPx === widthPx && prev.heightPx === heightPx ? prev : { widthPx, heightPx },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewFullscreen]);

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
        const hasPersistedVideo = workspaceJsonHasPersistedVideo(rawWorkspaceJson);
        if (!hasPersistedVideo) {
          router.replace('/video-edit/upload');
          return;
        }
        setWorkspaceUiPhase('editor');
      } catch (error) {
        if (cancelled) return;
        setWorkspaceSyncStatus(
          error instanceof Error ? `Workspace load failed: ${error.message}` : 'Workspace load failed',
        );
        router.replace('/video-edit/upload');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyHistorySnapshot, router]);

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

  const onAudioFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const createdTrackId = addAudioTrack('music', file);
        void uploadVideoEditorFile(file)
          .then((uploaded) => {
            updateAudioTrack(createdTrackId, {
              exportSrc: withWorkspaceObjectKey(uploaded.storageUrl, uploaded.s3Key),
            });
          })
          .catch((error) => {
            console.warn('[video-editor] music upload failed', error);
            setWorkspaceSyncStatus('Music upload failed. Export may miss this track.');
          });
      }
      e.target.value = '';
    },
    [addAudioTrack, updateAudioTrack],
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
      const { trimStart, trimEnd, videoTimelineSegments: vts } = useEditorStore.getState();
      const lo = trimEnd > trimStart ? trimStart : 0;
      const hi = trimEnd > trimStart ? trimEnd : duration;
      let next = Math.min(Math.max(v.currentTime, lo), hi);
      if (vts.length > 1) {
        next = clampTimeToVideoSegments(next, vts, duration);
      }
      if (Math.abs(v.currentTime - next) > 0.01) {
        v.currentTime = next;
      }
      setCurrentTime(next);
      void v.play().catch(() => {
        /* Ignore AbortError / "interrupted by pause" races */
      });
    } else {
      v.pause();
    }
  }, [duration, setCurrentTime, videoElement]);

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

  const onTimelineTrimHoverTimeChange = useCallback(
    (timeSec: number | null) => {
      if (timeSec == null || !Number.isFinite(timeSec) || duration <= 0) return;
      const next = Math.min(duration, Math.max(0, timeSec));
      const v = videoElement;
      if (v != null && Math.abs(v.currentTime - next) > 0.01) {
        v.currentTime = next;
      }
      setCurrentTime(next);
    },
    [duration, setCurrentTime, videoElement],
  );

  const onSplitAtPlayhead = useCallback(() => {
    splitVideoAtPlayhead();
    const v = videoElement;
    const next = useEditorStore.getState().currentTime;
    if (v) v.currentTime = next;
    setCurrentTime(next);
  }, [splitVideoAtPlayhead, setCurrentTime, videoElement]);

  const syncVideoToStorePlayhead = useCallback(() => {
    const v = videoElement;
    const next = useEditorStore.getState().currentTime;
    if (v) v.currentTime = next;
    setCurrentTime(next);
  }, [setCurrentTime, videoElement]);

  const onTrimHeadAtPlayhead = useCallback(() => {
    trimHeadToPlayhead();
    syncVideoToStorePlayhead();
  }, [trimHeadToPlayhead, syncVideoToStorePlayhead]);

  const onTrimTailAtPlayhead = useCallback(() => {
    trimTailToPlayhead();
    syncVideoToStorePlayhead();
  }, [trimTailToPlayhead, syncVideoToStorePlayhead]);

  const onTrimMiddleAtPlayhead = useCallback(() => {
    deleteVideoTimelineSegmentAtPlayhead();
    syncVideoToStorePlayhead();
  }, [deleteVideoTimelineSegmentAtPlayhead, syncVideoToStorePlayhead]);

  const trimMiddleAtPlayheadEnabled = useMemo(() => {
    if (duration <= 0) return false;
    const segs = videoTimelineSegments;
    if (segs.length < 2) return false;
    return segs.some(
      (s) =>
        currentTime > s.startTime + 1e-4 &&
        currentTime < s.endTime - 1e-4,
    );
  }, [currentTime, duration, videoTimelineSegments]);

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
        { id: 'text' as const, label: t('tools.text') },
        { id: 'blur' as const, label: t('tools.blur') },
        { id: 'image' as const, label: t('tools.image') },
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

  const speed = playbackSpeed > 0 && Number.isFinite(playbackSpeed) ? playbackSpeed : 1;
  const timeDisplay = t('timeAtPlayhead', {
    current: formatWorkspaceTime(currentTime / speed),
    total: formatWorkspaceTime(duration / speed),
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
    activeTool === 'speed' ||
    activeTool === 'subs' ||
    activeTool === 'audio' ||
    selectedSegmentId != null ||
    (selectedLayerId != null && !selectedIsVideoTimelineClip);

  const panelMode: 'segment' | 'speed' | 'subs' | 'audio' | 'blur' | 'image' | 'text' | null =
    selectedSegmentId != null
      ? 'segment'
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

  const estimateAudioMbForExport = useCallback(() => {
    const state = useEditorStore.getState();
    const totalAudioSec = state.audioTracks
      .filter((track) => track.type === 'music' || track.type === 'voiceover')
      .reduce((sum, track) => sum + Math.max(0, track.endTime - track.startTime), 0);
    const bytes = (totalAudioSec * EXPORT_AUDIO_ESTIMATE_BITRATE_BPS) / 8;
    return Math.max(0, bytes / (1024 * 1024));
  }, []);

  const estimateEffectiveVideoLengthSec = useCallback(() => {
    const state = useEditorStore.getState();
    if (state.videoTimelineSegments.length > 0) {
      const sum = state.videoTimelineSegments.reduce(
        (acc, seg) => acc + Math.max(0, seg.endTime - seg.startTime),
        0,
      );
      if (sum > 0) return sum;
    }
    if (state.trimEnd > state.trimStart) return state.trimEnd - state.trimStart;
    return Math.max(0, state.duration);
  }, []);

  const executeExport = useCallback(async () => {
    let state = useEditorStore.getState();
    const pendingAudioTrack = state.audioTracks.find(
      (track) =>
        typeof track.src === 'string' &&
        track.src.startsWith('blob:') &&
        (typeof track.exportSrc !== 'string' || track.exportSrc.trim() === ''),
    );
    if (pendingAudioTrack != null) {
      setWorkspaceSyncStatus(
        `Audio "${pendingAudioTrack.name}" is still uploading. Exporting with uploaded tracks only.`,
      );
    }
    if (resolveExportVideoUrl(state.videoSrc) == null) {
      setWorkspaceSyncStatus(
        state.videoSrc?.startsWith('blob:')
          ? 'Wait for the video to finish uploading before exporting.'
          : 'Add a video and ensure it is uploaded (not only a local preview) before exporting.',
      );
      return;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
    state = useEditorStore.getState();
    // Export must respect the top-bar aspect choice even if crop panel/workspace hydration
    // left `cropSettings.easyAspect` out of sync with the selected orientation.
    const payload = buildExportPayload({
      ...state,
      cropSettings: {
        ...state.cropSettings,
        easyAspect: aspectIdToRatio(aspect),
      },
    });
    setExportProgressPercent(8);
    setExportProgressMessage('Preparing export job');
    setExportOverlayPhase('exporting');
    setWorkspaceSyncStatus('Exporting video...');
    try {
      const result = await exportVideoEditorWorkspace(payload);
      if (result.generationId != null) {
        setExportProgressPercent(14);
        setExportProgressMessage('Export job queued');
        const exportSseOverrides = {
          subscribedLabel: 'Export queued',
          subscribedPercent: 18,
          stages: {
            workspace_export_started: { percent: 28, label: 'Rendering timeline' },
            workspace_export_encoding: { percent: 62, label: 'Encoding video' },
            workspace_export_uploading: { percent: 88, label: 'Uploading result' },
          },
        } as const;
        const sseResult = await new Promise<{ downloadUrl: string; s3Key: string }>((resolve, reject) => {
          openGenerationJobSseStream(result.generationId!, {
            onStatus: (raw) => {
              const p = parseGenerationSseProgressPayload(raw, exportSseOverrides);
              if (p) {
                setExportProgressPercent((prev) => Math.max(prev, Math.min(99, p.percent)));
                setExportProgressMessage(p.label);
              }
            },
            onDone: () => {},
            onError: (message) => {
              reject(new Error(message || 'Export stream failed'));
            },
            onTerminal: (payload) => {
              if (payload.status !== 'completed') {
                reject(new Error(payload.message || 'Export failed'));
                return;
              }
              const output =
                typeof payload.outputData === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(payload.outputData) as Record<string, unknown>;
                      } catch {
                        return undefined;
                      }
                    })()
                  : payload.outputData != null && typeof payload.outputData === 'object'
                    ? (payload.outputData as Record<string, unknown>)
                    : undefined;
              const resultNode =
                output && typeof output.result === 'object' && output.result != null
                  ? (output.result as Record<string, unknown>)
                  : undefined;
              const pick = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
              /** Worker `WorkspaceExportPipeline` publishes `result.readUrl` / `storageUrl` / `s3Key` (not always `downloadUrl`). */
              const downloadUrl =
                pick(resultNode?.readUrl) ||
                pick(resultNode?.downloadUrl) ||
                pick(resultNode?.storageUrl) ||
                (output ? pick(output.readUrl) || pick(output.downloadUrl) || pick(output.storageUrl) : '') ||
                pick(result.downloadUrl) ||
                '';
              const s3Key =
                pick(resultNode?.s3Key) || pick(result.s3Key) || '';
              if (!downloadUrl) {
                reject(new Error('Export completed but missing download URL'));
                return;
              }
              resolve({ downloadUrl, s3Key });
            },
          });
        });
        setExportProgressPercent(100);
        setExportProgressMessage('Export ready');
        setExportOverlayPhase('downloading');
        setWorkspaceSyncStatus('Downloading export...');
        await triggerWorkspaceExportDownload(sseResult.downloadUrl, sseResult.s3Key);
      } else {
        setExportProgressPercent(100);
        setExportProgressMessage('Export ready');
        setExportOverlayPhase('downloading');
        setWorkspaceSyncStatus('Downloading export...');
        await triggerWorkspaceExportDownload(result.downloadUrl, result.s3Key);
      }
      setWorkspaceSyncStatus('Export downloaded');
    } catch (error) {
      setWorkspaceSyncStatus(
        error instanceof Error ? `Export failed: ${error.message}` : 'Export failed',
      );
    } finally {
      setExportOverlayPhase('idle');
      setExportProgressPercent(0);
      setExportProgressMessage('');
    }
  }, [aspect]);

  const onExportClick = useCallback(async () => {
    setExportEstimateError(null);
    setExportConfirmOpen(true);
    setExportEstimateLoading(true);
    try {
      const state = useEditorStore.getState();
      // Match viral editor behavior: read the workspace object key from `videoSrc#wk=...`.
      // Do NOT use `resolveExportVideoUrl` here because it strips hash fragments.
      const videoSrcKey = extractWorkspaceKeyFromVideoSrc(state.videoSrc);
      if (videoSrcKey == null) {
        throw new Error('Video must be uploaded before export estimate.');
      }
      const me = await fetchMe();
      setCreditBalance(typeof me?.creditBalance === 'number' ? me.creditBalance : null);
      const serverEstimate = await videoEditorExportEstimateExisting(videoSrcKey);
      const reserveFromServer = Number(serverEstimate.reserveCostPoints);
      const mbVideoRaw = Number(serverEstimate.mbVideo ?? 0);
      const mbVideo = Number.isFinite(mbVideoRaw) ? Math.max(0, mbVideoRaw) : 0;
      const mbAudio = estimateAudioMbForExport();
      const videoLengthSec = estimateEffectiveVideoLengthSec();
      const addedAudioPoints = Math.max(0, Math.ceil(mbAudio * 2));
      const addedLengthPoints = Math.max(
        0,
        Math.ceil((videoLengthSec / 60) * EXPORT_VIDEO_LENGTH_POINT_PER_MIN),
      );
      const estimated = Math.max(0, reserveFromServer) + addedAudioPoints + addedLengthPoints;
      setExportEstimateBreakdown({
        mbVideo,
        mbAudio,
        videoLengthSec,
        fromServerReservePoints: Math.max(0, reserveFromServer),
        addedAudioPoints,
        addedLengthPoints,
      });
      setExportEstimatedPoints(estimated);
    } catch (error) {
      setExportEstimateError(
        error instanceof Error ? error.message : 'Failed to estimate export points',
      );
      setExportEstimateBreakdown(null);
      setExportEstimatedPoints(0);
    } finally {
      setExportEstimateLoading(false);
    }
  }, [estimateAudioMbForExport, estimateEffectiveVideoLengthSec]);

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
      setResetDialogOpen(false);
      router.replace('/video-edit/upload');
    } catch (error) {
      setWorkspaceSyncStatus(
        error instanceof Error ? `Workspace reset failed: ${error.message}` : 'Workspace reset failed',
      );
    } finally {
      setResetBusy(false);
    }
  }, [router, setActiveToolStore, setSelectedAudioTrackId, setSelectedLayerId, setSelectedSegmentId, setVideoSrc]);

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
      <div className="video-workspace-root flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-zinc-100 text-foreground dark:bg-black">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400"
          aria-hidden
        />
        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-500">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="video-workspace-root relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100 text-foreground dark:bg-black">
      <WorkspaceTopBar
        exportLabel={t('exportVideo')}
        exportDisabled={resolveExportVideoUrl(videoSrc) == null}
        exportDisabledTitle={
          videoSrc?.startsWith('blob:')
            ? t('exportGuard.waitForUpload')
            : videoSrc == null
              ? t('exportGuard.addVideoFirst')
              : t('exportGuard.httpsRequired')
        }
        resetLabel={t('resetDialog.confirm')}
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
        <div ref={centerColumnRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-hidden">
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/x-aac,.mp3,.wav,.aac"
            className="sr-only"
            aria-hidden
            onChange={onAudioFile}
          />
          <div
            ref={previewPaneRef}
            className={`flex min-h-0 flex-1 flex-col ${
              previewFullscreen ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto overscroll-y-contain'
            } ${previewFullscreen ? '' : 'box-border px-4 pb-5 pt-4 sm:px-6 sm:pb-7 sm:pt-5'}`}
            style={previewFullscreen ? undefined : { minHeight: getPreviewPanelMinHeightPx() }}
          >
            <WorkspacePreviewCanvas
              ref={previewFrameRef}
              canvasLabel={t('canvasAria')}
              aspect={aspect}
              skipInitialCanvasSizeStep
              isFullscreen={previewFullscreen}
              previewFill={
                previewFullscreen || previewPaneSize.widthPx < 32 || previewPaneSize.heightPx < 32
                  ? null
                  : previewPaneSize
              }
            />
          </div>
          <div
            ref={timelineSeparatorRef}
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('timeline.resizeHandleAria')}
            title={t('timeline.resizeHandleTitle')}
            onPointerDown={onTimelineDockResizePointerDown}
            className="group relative z-10 flex min-h-8 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-transparent bg-transparent py-1 hover:border-zinc-300/80 hover:bg-zinc-200/60 dark:hover:border-white/10 dark:hover:bg-white/5 [@media(pointer:coarse)]:min-h-11"
          >
            <span
              className="h-1 w-12 rounded-full bg-zinc-400/50 transition-colors group-hover:bg-violet-500/70 dark:bg-white/20 dark:group-hover:bg-violet-400/70"
              aria-hidden
            />
          </div>
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden"
            style={{ height: timelineDockHeightPx }}
          >
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
            playheadTimeSec={currentTime}
            onTrimHoverTimeChange={onTimelineTrimHoverTimeChange}
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
            trimHeadLabel={t('timeline.trim.trimHead')}
            trimHeadAriaLabel={t('timeline.trim.trimHeadAria')}
            onTrimHeadAtPlayhead={onTrimHeadAtPlayhead}
            trimTailLabel={t('timeline.trim.trimTail')}
            trimTailAriaLabel={t('timeline.trim.trimTailAria')}
            onTrimTailAtPlayhead={onTrimTailAtPlayhead}
            trimMiddleLabel={t('timeline.trim.trimMiddle')}
            trimMiddleAriaLabel={t('timeline.trim.trimMiddleAria')}
            trimMiddleEnabled={trimMiddleAtPlayheadEnabled}
            onTrimMiddleAtPlayhead={onTrimMiddleAtPlayhead}
            deleteSegmentLabel={t('timeline.trim.deleteSegment')}
            deleteSegmentAriaLabel={t('timeline.trim.deleteSegmentAria')}
            deleteSegmentEnabled={canDeleteSelectedVideoSegment}
            onDeleteVideoSegment={onDeleteSelectedVideoSegment}
            audioUploadVisible={activeTool === 'audio'}
            addAudioLabel={t('audio.addAudio')}
            onAddAudio={() => audioInputRef.current?.click()}
            />
          </div>
        </div>
        {activeTool !== 'media' && activeTool !== 'trim' || selectedSegmentId != null ? (
          showStoreToolPanel ? (
            <aside className="flex max-h-[55vh] min-h-0 w-full shrink-0 flex-col border-t border-zinc-200/90 bg-white/95 xl:h-full xl:max-h-none xl:w-72 xl:min-w-72 xl:max-w-72 xl:border-l xl:border-t-0 dark:border-white/10 dark:bg-black/70">
              <div className="shrink-0 border-b border-zinc-200/90 px-4 py-3 dark:border-white/10">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {panelMode === 'segment'
                    ? t('audio.segmentAudio')
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
                        {t('image.dragHint')}
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
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] dark:bg-black/70"
            aria-label={t('resetDialog.cancel')}
            onClick={() => !resetBusy && setResetDialogOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-reset-title"
            aria-describedby="workspace-reset-desc"
            className="relative z-[101] w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-400/40 sm:p-6 dark:border-white/10 dark:bg-zinc-950 dark:shadow-black/60"
          >
            <h2 id="workspace-reset-title" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              {t('resetDialog.title')}
            </h2>
            <p id="workspace-reset-desc" className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t('resetDialog.description')}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => setResetDialogOpen(false)}
                className="rounded-xl border border-zinc-300 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
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

      {exportOverlayPhase !== 'idle' ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 text-foreground backdrop-blur-sm dark:bg-black"
          aria-busy={true}
          aria-live="polite"
          role="status"
        >
          <div className="w-[min(88vw,380px)] rounded-xl border border-zinc-200 bg-white/95 p-4 dark:border-white/10 dark:bg-zinc-950/80">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(
                    6,
                    Math.min(
                      100,
                      exportOverlayPhase === 'downloading'
                        ? 100
                        : exportProgressPercent,
                    ),
                  )}%`,
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
              <span>
                {exportProgressMessage.trim() !== ''
                  ? exportProgressMessage
                  : exportOverlayPhase === 'exporting'
                    ? t('exportOverlay.exporting')
                    : t('exportOverlay.downloading')}
              </span>
              <span>
                {exportOverlayPhase === 'downloading'
                  ? '100%'
                  : `${Math.max(0, Math.min(100, Math.round(exportProgressPercent)))}%`}
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-500">
            {exportOverlayPhase === 'exporting'
              ? t('exportOverlay.exporting')
              : t('exportOverlay.downloading')}
          </p>
        </div>
      ) : null}

      {exportConfirmOpen ? (
        <div
          className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[1px] sm:items-center dark:bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label={t('exportConfirm.ariaLabel')}
          onMouseDown={() => setExportConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-400/35 dark:border-white/10 dark:bg-zinc-950 dark:shadow-black/60"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t('exportConfirm.title')}</p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {t('exportConfirm.estimatedCost')}{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {exportEstimateLoading ? '…' : exportEstimatedPoints}
              </span>{' '}
              {t('exportConfirm.pointsUnit')}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{t('exportConfirm.balance', { points: creditBalance ?? 0 })}</p>
            {exportEstimateError ? (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{exportEstimateError}</p>
            ) : null}
            {creditBalance != null && creditBalance < exportEstimatedPoints && !exportEstimateLoading ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {t('exportConfirm.notEnoughPoints')}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
                onClick={() => setExportConfirmOpen(false)}
              >
                {t('exportConfirm.cancel')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
                disabled={
                  exportEstimateLoading ||
                  exportEstimateError != null ||
                  (creditBalance != null && creditBalance < exportEstimatedPoints)
                }
                onClick={() => {
                  setExportConfirmOpen(false);
                  void executeExport();
                }}
              >
                {t('exportConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
