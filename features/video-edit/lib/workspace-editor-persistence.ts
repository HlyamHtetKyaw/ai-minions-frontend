'use client';

import { useEditorStore, type EditorTool } from '@/store/editorStore';

export type WorkspaceHistorySnapshot = {
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

export function createWorkspaceHistorySnapshot(
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

export function snapshotSignature(snapshot: WorkspaceHistorySnapshot) {
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

export function withWorkspaceObjectKey(url: string, key: string): string {
  const safeUrl = typeof url === 'string' ? url.trim() : '';
  const safeKey = typeof key === 'string' ? key.trim() : '';
  if (safeUrl === '' || safeKey === '') return safeUrl;
  return `${safeUrl}#wk=${encodeURIComponent(safeKey)}`;
}

export function extractWorkspaceKeyFromVideoSrc(value: string | null): string | null {
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

export function serializeWorkspaceForPersistence(state: ReturnType<typeof useEditorStore.getState>): string {
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
  const core = {
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
  } as Record<string, unknown>;
  return JSON.stringify(core);
}

export function parseWorkspaceFromPersistence(rawJson: string): WorkspaceHistorySnapshot | null {
  try {
    const root = JSON.parse(rawJson) as Record<string, unknown>;
    // Legacy: viral lived nested in the same document; never hydrate the editor from it.
    delete root.viralShortsWorkspace;
    const raw = root as WorkspaceHistorySnapshot & {
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
