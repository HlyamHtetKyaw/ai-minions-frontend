import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { clampTimeToVideoSegments } from '@/lib/videoSegmentTime';

export type TextLayer = {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
  startTime: number;
  endTime: number;
};

export type BlurLayer = {
  id: string;
  type: 'blur';
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  opacity: number;
  startTime: number;
  endTime: number;
};

export type GalleryImage = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  size: number;
};

export type ImageLayer = {
  id: string;
  type: 'image';
  galleryImageId: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  fitMode: 'free' | 'fit' | 'fill' | 'stretch';
  startTime: number;
  endTime: number;
  lockAspectRatio: boolean;
};

/** Pixel rect in react-easy-crop space (rotated natural-media bbox). */
export type CropPixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropSettings = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  isApplied: boolean;
  /** react-easy-crop drag position (px, internal). */
  easyCrop: { x: number; y: number };
  easyZoom: number;
  easyRotation: number;
  /** Crop window width ÷ height. */
  easyAspect: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  croppedAreaPixels: CropPixelRect | null;
  croppedAreaPercentages: CropPixelRect | null;
};

export type AudioTrack = {
  id: string;
  type: 'music' | 'voiceover' | 'original';
  name: string;
  src: string;
  startTime: number;
  endTime: number;
  volume: number;
  isMuted: boolean;
  fadeIn: number;
  fadeOut: number;
  audioBuffer: AudioBuffer | null;
};

export type EditorTool =
  | 'pointer'
  | 'text'
  | 'blur'
  | 'image'
  | 'crop'
  | 'speed'
  | 'audio'
  | 'trim';

/** Timeline id for the primary video / waveform clip (not a text layer). */
export const MAIN_VIDEO_TIMELINE_CLIP_ID = 'main-video';

/** Contiguous slice of the source file (seconds). Workspace splits create multiple segments without deleting media. */
export type VideoTimelineSegment = {
  id: string;
  startTime: number;
  endTime: number;
};

const MIN_VIDEO_CLIP_SEC = 1;
const DEFAULT_TEXT_LAYER_SPAN_SEC = 10;

const defaultCropSettings = (): CropSettings => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  isApplied: false,
  easyCrop: { x: 0, y: 0 },
  easyZoom: 1,
  easyRotation: 0,
  easyAspect: 16 / 9,
  flipHorizontal: false,
  flipVertical: false,
  croppedAreaPixels: null,
  croppedAreaPercentages: null,
});

export type EditorState = {
  videoSrc: string | null;
  duration: number;
  currentTime: number;
  /** Inclusive start of the kept video segment for preview + export (seconds, file clock). */
  trimStart: number;
  /** Inclusive end of the kept segment (seconds, file clock). */
  trimEnd: number;
  /** Incremented by `applyTrim()` for export / side effects. */
  trimApplyNonce: number;
  isPlaying: boolean;
  /** Shared ref to the canvas `<video>` for seeking from the timeline. */
  videoElement: HTMLVideoElement | null;
  /** Decoded audio from the video file (browser extraction). */
  audioBuffer: AudioBuffer | null;
  isExtractingAudio: boolean;
  textLayers: TextLayer[];
  blurLayers: BlurLayer[];
  galleryImages: GalleryImage[];
  imageLayers: ImageLayer[];
  cropSettings: CropSettings;
  isCropActive: boolean;
  playbackSpeed: number;
  /** Displayed video frame size in CSS pixels (for crop / FFmpeg scale). */
  canvasFrameWidth: number;
  canvasFrameHeight: number;
  /** Mirrors `canvasFrameWidth` / `canvasFrameHeight` for image placement. */
  canvasSize: { width: number; height: number };
  /** Intrinsic video dimensions from metadata. */
  videoNaturalWidth: number;
  videoNaturalHeight: number;
  selectedLayerId: string | null;
  activeTool: EditorTool;
  audioTracks: AudioTrack[];
  originalAudioMuted: boolean;
  originalAudioVolume: number;
  selectedAudioTrackId: string | null;
  /** Ordered partition of [0, duration] for workspace timeline; empty until duration is known. */
  videoTimelineSegments: VideoTimelineSegment[];
  setVideoSrc: (src: string | null) => void;
  setDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setVideoElement: (el: HTMLVideoElement | null) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  setIsExtractingAudio: (v: boolean) => void;
  setCanvasFrameSize: (w: number, h: number) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setVideoNaturalSize: (w: number, h: number) => void;
  updateVideoClipRange: (patch: { startTime?: number; endTime?: number }) => void;
  setTrimStart: (t: number) => void;
  setTrimEnd: (t: number) => void;
  resetTrim: () => void;
  applyTrim: () => void;
  addTextLayer: () => void;
  importSrtCuesAsTextLayers: (
    cues: Array<{ startTime: number; endTime: number; content: string }>,
  ) => void;
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void;
  deleteTextLayer: (id: string) => void;
  addBlurLayer: () => void;
  updateBlurLayer: (id: string, patch: Partial<BlurLayer>) => void;
  deleteBlurLayer: (id: string) => void;
  addGalleryImage: (file: File) => Promise<GalleryImage>;
  deleteGalleryImage: (id: string) => void;
  addImageLayer: (galleryImage: GalleryImage) => void;
  updateImageLayer: (id: string, patch: Partial<ImageLayer>) => void;
  deleteImageLayer: (id: string) => void;
  setCropSettings: (patch: Partial<CropSettings>) => void;
  setIsCropActive: (v: boolean) => void;
  applyCrop: () => void;
  resetCrop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setSelectedLayerId: (id: string | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  addAudioTrack: (type: 'music' | 'voiceover', file: File) => void;
  updateAudioTrack: (id: string, patch: Partial<AudioTrack>) => void;
  deleteAudioTrack: (id: string) => void;
  setOriginalAudioMuted: (v: boolean) => void;
  setOriginalAudioVolume: (v: number) => void;
  setSelectedAudioTrackId: (id: string | null) => void;
  setAudioTrackBuffer: (id: string, buffer: AudioBuffer) => void;
  /** Split the segment under `currentTime` into two; nothing is deleted. Full timeline stays playable. */
  splitVideoAtPlayhead: () => void;
  updateVideoTimelineSegment: (
    id: string,
    patch: { startTime?: number; endTime?: number },
  ) => void;
  /** Remove one segment (requires at least two). Remaining clips stay on the source timeline; gaps skip on playback. */
  deleteVideoTimelineSegment: (id: string) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  videoSrc: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  videoElement: null,
  audioBuffer: null,
  isExtractingAudio: false,
  trimStart: 0,
  trimEnd: 0,
  trimApplyNonce: 0,
  textLayers: [],
  blurLayers: [],
  galleryImages: [],
  imageLayers: [],
  cropSettings: defaultCropSettings(),
  isCropActive: false,
  playbackSpeed: 1,
  canvasFrameWidth: 0,
  canvasFrameHeight: 0,
  canvasSize: { width: 0, height: 0 },
  videoNaturalWidth: 0,
  videoNaturalHeight: 0,
  selectedLayerId: null,
  activeTool: 'pointer',
  audioTracks: [],
  originalAudioMuted: false,
  originalAudioVolume: 100,
  selectedAudioTrackId: null,
  videoTimelineSegments: [],
  setVideoSrc: (src) =>
    set((state) => {
      const prev = state.videoSrc;
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      for (const t of state.audioTracks) {
        if (t.src.startsWith('blob:')) {
          URL.revokeObjectURL(t.src);
        }
      }
      for (const g of state.galleryImages) {
        if (g.src.startsWith('blob:')) {
          URL.revokeObjectURL(g.src);
        }
      }
      return {
        videoSrc: src,
        audioBuffer: null,
        isExtractingAudio: false,
        audioTracks: [],
        originalAudioMuted: false,
        originalAudioVolume: 100,
        selectedAudioTrackId: null,
        ...(src
          ? {
              /** Reset so the next `setDuration` from metadata uses the first-load path and spans [0, d]. */
              duration: 0,
              currentTime: 0,
              isPlaying: false,
              trimStart: 0,
              trimEnd: 0,
              trimApplyNonce: 0,
              videoTimelineSegments: [],
              blurLayers: [],
              galleryImages: [],
              imageLayers: [],
              cropSettings: defaultCropSettings(),
              isCropActive: false,
              playbackSpeed: 1,
              canvasFrameWidth: 0,
              canvasFrameHeight: 0,
              canvasSize: { width: 0, height: 0 },
              videoNaturalWidth: 0,
              videoNaturalHeight: 0,
            }
          : {
              duration: 0,
              currentTime: 0,
              isPlaying: false,
              trimStart: 0,
              trimEnd: 0,
              trimApplyNonce: 0,
              videoTimelineSegments: [],
              textLayers: [],
              blurLayers: [],
              galleryImages: [],
              imageLayers: [],
              selectedLayerId: null,
              cropSettings: defaultCropSettings(),
              isCropActive: false,
              playbackSpeed: 1,
              canvasFrameWidth: 0,
              canvasFrameHeight: 0,
              canvasSize: { width: 0, height: 0 },
              videoNaturalWidth: 0,
              videoNaturalHeight: 0,
            }),
      };
    }),
  setDuration: (d) =>
    set((state) => {
      if (!Number.isFinite(d) || d <= 0) {
        return { duration: d };
      }
      if (state.duration <= 0) {
        const fixedTracks =
          state.audioTracks.length > 0
            ? state.audioTracks.map((t) => {
                let end = t.endTime <= 0 ? d : t.endTime;
                end = Math.min(end, d);
                let start = Math.min(t.startTime, Math.max(0, end - MIN_VIDEO_CLIP_SEC));
                end = Math.max(start + MIN_VIDEO_CLIP_SEC, end);
                return { ...t, startTime: start, endTime: end };
              })
            : state.audioTracks;
        return {
          duration: d,
          trimStart: 0,
          trimEnd: d,
          videoTimelineSegments: [
            { id: MAIN_VIDEO_TIMELINE_CLIP_ID, startTime: 0, endTime: d },
          ],
          audioTracks: fixedTracks,
        };
      }
      const maxStart = Math.max(0, d - MIN_VIDEO_CLIP_SEC);
      let start = Math.min(Math.max(0, state.trimStart), maxStart);
      let end = Math.min(Math.max(start + MIN_VIDEO_CLIP_SEC, state.trimEnd), d);
      if (end - start < MIN_VIDEO_CLIP_SEC) {
        end = Math.min(d, start + MIN_VIDEO_CLIP_SEC);
        start = Math.max(0, end - MIN_VIDEO_CLIP_SEC);
      }
      const audioTracks = state.audioTracks.map((t) => {
        let endT = Math.min(t.endTime, d);
        let startT = Math.min(t.startTime, Math.max(0, endT - MIN_VIDEO_CLIP_SEC));
        endT = Math.max(startT + MIN_VIDEO_CLIP_SEC, endT);
        return { ...t, startTime: startT, endTime: endT };
      });

      let videoTimelineSegments = state.videoTimelineSegments;
      if (videoTimelineSegments.length > 0) {
        const clamped = videoTimelineSegments
          .map((s) => ({
            ...s,
            startTime: Math.max(0, Math.min(s.startTime, d)),
            endTime: Math.max(0, Math.min(s.endTime, d)),
          }))
          .filter((s) => s.endTime - s.startTime >= MIN_VIDEO_CLIP_SEC - 1e-6);
        if (clamped.length === 0) {
          videoTimelineSegments = [
            { id: MAIN_VIDEO_TIMELINE_CLIP_ID, startTime: 0, endTime: d },
          ];
        } else {
          clamped[0] = { ...clamped[0], startTime: 0 };
          clamped[clamped.length - 1] = {
            ...clamped[clamped.length - 1],
            endTime: d,
          };
          for (let i = 0; i < clamped.length - 1; i++) {
            const lo = clamped[i].startTime + MIN_VIDEO_CLIP_SEC;
            const hi = clamped[i + 1].endTime - MIN_VIDEO_CLIP_SEC;
            const boundary =
              hi >= lo ? Math.min(hi, Math.max(lo, clamped[i].endTime)) : lo;
            clamped[i] = { ...clamped[i], endTime: boundary };
            clamped[i + 1] = { ...clamped[i + 1], startTime: boundary };
          }
          videoTimelineSegments = clamped;
        }
      }

      let trimStart = start;
      let trimEnd = end;
      if (videoTimelineSegments.length === 1) {
        trimStart = videoTimelineSegments[0].startTime;
        trimEnd = videoTimelineSegments[0].endTime;
      } else if (
        videoTimelineSegments.length > 1 &&
        videoTimelineSegments[0].startTime <= 1e-4 &&
        videoTimelineSegments[videoTimelineSegments.length - 1].endTime >= d - 1e-4
      ) {
        trimStart = 0;
        trimEnd = d;
      }

      return {
        duration: d,
        trimStart,
        trimEnd,
        audioTracks,
        videoTimelineSegments,
      };
    }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setVideoElement: (el) => set({ videoElement: el }),
  setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),
  setIsExtractingAudio: (v) => set({ isExtractingAudio: v }),
  setCanvasFrameSize: (w, h) =>
    set({
      canvasFrameWidth: Math.max(0, w),
      canvasFrameHeight: Math.max(0, h),
      canvasSize: { width: Math.max(0, w), height: Math.max(0, h) },
    }),
  setCanvasSize: (size) =>
    set({
      canvasFrameWidth: Math.max(0, size.width),
      canvasFrameHeight: Math.max(0, size.height),
      canvasSize: {
        width: Math.max(0, size.width),
        height: Math.max(0, size.height),
      },
    }),
  setVideoNaturalSize: (w, h) =>
    set({
      videoNaturalWidth: Math.max(0, w),
      videoNaturalHeight: Math.max(0, h),
    }),
  updateVideoClipRange: (patch) =>
    set((state) => {
      const d = state.duration;
      if (d <= 0) return {};
      let start = patch.startTime ?? state.trimStart;
      let end = patch.endTime ?? state.trimEnd;
      end = Math.min(Math.max(end, start + MIN_VIDEO_CLIP_SEC), d);
      start = Math.max(0, Math.min(start, end - MIN_VIDEO_CLIP_SEC));
      let currentTime = state.currentTime;
      if (currentTime < start) currentTime = start;
      if (currentTime > end) currentTime = end;
      let videoTimelineSegments = state.videoTimelineSegments;
      if (videoTimelineSegments.length === 1) {
        videoTimelineSegments = [
          { ...videoTimelineSegments[0], startTime: start, endTime: end },
        ];
      }
      return { trimStart: start, trimEnd: end, currentTime, videoTimelineSegments };
    }),
  setTrimStart: (t) =>
    set((state) => {
      const d = state.duration;
      if (d <= 0) return {};
      const maxStart = Math.max(0, state.trimEnd - MIN_VIDEO_CLIP_SEC);
      const start = Math.min(Math.max(0, t), maxStart);
      let currentTime = state.currentTime;
      if (currentTime < start) currentTime = start;
      let videoTimelineSegments = state.videoTimelineSegments;
      if (videoTimelineSegments.length === 1) {
        videoTimelineSegments = [
          { ...videoTimelineSegments[0], startTime: start, endTime: state.trimEnd },
        ];
      }
      return { trimStart: start, currentTime, videoTimelineSegments };
    }),
  setTrimEnd: (t) =>
    set((state) => {
      const d = state.duration;
      if (d <= 0) return {};
      const minEnd = state.trimStart + MIN_VIDEO_CLIP_SEC;
      const end = Math.min(Math.max(t, minEnd), d);
      let currentTime = state.currentTime;
      if (currentTime > end) currentTime = end;
      let videoTimelineSegments = state.videoTimelineSegments;
      if (videoTimelineSegments.length === 1) {
        videoTimelineSegments = [
          { ...videoTimelineSegments[0], startTime: state.trimStart, endTime: end },
        ];
      }
      return { trimEnd: end, currentTime, videoTimelineSegments };
    }),
  resetTrim: () =>
    set((state) => {
      const d = state.duration > 0 ? state.duration : 0;
      return {
        trimStart: 0,
        trimEnd: d,
        videoTimelineSegments:
          d > 0
            ? [{ id: MAIN_VIDEO_TIMELINE_CLIP_ID, startTime: 0, endTime: d }]
            : [],
      };
    }),
  applyTrim: () =>
    set((state) => ({ trimApplyNonce: state.trimApplyNonce + 1 })),
  addTextLayer: () =>
    set((state) => {
      const id = nanoid();
      const d = state.duration;
      const t = state.currentTime;
      let startTime = 0;
      let endTime = 0;
      if (d > 0) {
        startTime = Math.min(Math.max(0, t), d);
        endTime = Math.min(d, startTime + DEFAULT_TEXT_LAYER_SPAN_SEC);
        if (endTime - startTime < MIN_VIDEO_CLIP_SEC) {
          endTime = Math.min(d, startTime + MIN_VIDEO_CLIP_SEC);
        }
        if (endTime - startTime < MIN_VIDEO_CLIP_SEC) {
          startTime = Math.max(0, d - MIN_VIDEO_CLIP_SEC);
          endTime = d;
        }
      }
      const layer: TextLayer = {
        id,
        type: 'text',
        content: 'New Text',
        x: 100,
        y: 100,
        width: 200,
        height: 60,
        fontSize: 24,
        fontFamily: 'Inter',
        color: '#ffffff',
        opacity: 100,
        startTime,
        endTime,
      };
      return {
        textLayers: [...state.textLayers, layer],
        selectedLayerId: id,
      };
    }),
  importSrtCuesAsTextLayers: (cues) =>
    set((state) => {
      if (cues.length === 0) return {};
      const d = state.duration;
      const newLayers: TextLayer[] = cues.map((cue) => {
        let startTime = Math.max(0, cue.startTime);
        let endTime = Math.max(startTime + MIN_VIDEO_CLIP_SEC, cue.endTime);
        if (d > 0) {
          startTime = Math.min(startTime, d);
          endTime = Math.min(Math.max(endTime, startTime + MIN_VIDEO_CLIP_SEC), d);
        }
        const content =
          cue.content.replace(/\r\n/g, '\n').trim() || ' ';
        return {
          id: nanoid(),
          type: 'text' as const,
          content,
          x: 100,
          y: 100,
          width: 200,
          height: 60,
          fontSize: 24,
          fontFamily: 'Inter',
          color: '#ffffff',
          opacity: 100,
          startTime,
          endTime,
        };
      });
      const lastId = newLayers[newLayers.length - 1]!.id;
      return {
        textLayers: [...state.textLayers, ...newLayers],
        selectedLayerId: lastId,
      };
    }),
  updateTextLayer: (id, patch) =>
    set((state) => ({
      textLayers: state.textLayers.map((l) =>
        l.id === id ? { ...l, ...patch } : l,
      ),
    })),
  deleteTextLayer: (id) =>
    set((state) => ({
      textLayers: state.textLayers.filter((l) => l.id !== id),
    })),
  addBlurLayer: () =>
    set((state) => {
      const id = nanoid();
      const layer: BlurLayer = {
        id,
        type: 'blur',
        x: 80,
        y: 80,
        width: 150,
        height: 150,
        intensity: 20,
        opacity: 100,
        startTime: 0,
        endTime: state.duration,
      };
      return {
        blurLayers: [...state.blurLayers, layer],
        selectedLayerId: id,
      };
    }),
  updateBlurLayer: (id, patch) =>
    set((state) => ({
      blurLayers: state.blurLayers.map((l) =>
        l.id === id ? { ...l, ...patch } : l,
      ),
    })),
  deleteBlurLayer: (id) =>
    set((state) => ({
      blurLayers: state.blurLayers.filter((l) => l.id !== id),
    })),
  addGalleryImage: async (file) => {
    const src = URL.createObjectURL(file);
    try {
      const dims = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              width: img.naturalWidth || 1,
              height: img.naturalHeight || 1,
            });
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = src;
        },
      );
      const galleryImage: GalleryImage = {
        id: nanoid(),
        name: file.name,
        src,
        width: dims.width,
        height: dims.height,
        size: file.size,
      };
      useEditorStore.setState((state) => ({
        galleryImages: [...state.galleryImages, galleryImage],
      }));
      return galleryImage;
    } catch {
      URL.revokeObjectURL(src);
      throw new Error('Could not read image dimensions');
    }
  },
  deleteGalleryImage: (id) =>
    set((state) => {
      const image = state.galleryImages.find((g) => g.id === id);
      if (image?.src.startsWith('blob:')) {
        URL.revokeObjectURL(image.src);
      }
      const removedLayerIds = new Set(
        state.imageLayers.filter((l) => l.galleryImageId === id).map((l) => l.id),
      );
      return {
        galleryImages: state.galleryImages.filter((g) => g.id !== id),
        imageLayers: state.imageLayers.filter((l) => l.galleryImageId !== id),
        selectedLayerId:
          state.selectedLayerId != null && removedLayerIds.has(state.selectedLayerId)
            ? null
            : state.selectedLayerId,
      };
    }),
  addImageLayer: (galleryImage) =>
    set((state) => {
      const id = nanoid();
      const d = state.duration;
      const cw =
        state.canvasFrameWidth > 0 ? state.canvasFrameWidth : state.canvasSize.width;
      const canvasW = cw > 0 ? cw : 640;
      const gw = Math.max(1, galleryImage.width);
      const gh = Math.max(1, galleryImage.height);
      const targetW = Math.min(gw, canvasW * 0.4);
      const height = (targetW * gh) / gw;
      const layer: ImageLayer = {
        id,
        type: 'image',
        galleryImageId: galleryImage.id,
        src: galleryImage.src,
        x: 50,
        y: 50,
        width: targetW,
        height,
        opacity: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        fitMode: 'free',
        startTime: 0,
        endTime: d > 0 ? d : 0,
        lockAspectRatio: true,
      };
      return {
        imageLayers: [...state.imageLayers, layer],
        selectedLayerId: id,
      };
    }),
  updateImageLayer: (id, patch) =>
    set((state) => {
      const d = state.duration;
      return {
        imageLayers: state.imageLayers.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, ...patch };
          if (d > 0) {
            let start = Math.max(0, next.startTime);
            let end = Math.min(d, next.endTime);
            if (end - start < MIN_VIDEO_CLIP_SEC) {
              end = Math.min(d, start + MIN_VIDEO_CLIP_SEC);
              start = Math.max(0, end - MIN_VIDEO_CLIP_SEC);
            }
            next.startTime = start;
            next.endTime = end;
          }
          return next;
        }),
      };
    }),
  deleteImageLayer: (id) =>
    set((state) => ({
      imageLayers: state.imageLayers.filter((l) => l.id !== id),
      selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
    })),
  setCropSettings: (patch) =>
    set((state) => ({
      cropSettings: { ...state.cropSettings, ...patch },
    })),
  setIsCropActive: (v) => set({ isCropActive: v }),
  applyCrop: () =>
    set((state) => ({
      cropSettings: { ...state.cropSettings, isApplied: true },
      isCropActive: false,
      activeTool: 'pointer',
    })),
  resetCrop: () =>
    set({
      cropSettings: defaultCropSettings(),
    }),
  setPlaybackSpeed: (speed) =>
    set({
      playbackSpeed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setActiveTool: (tool) =>
    set((state) => {
      const prev = state.activeTool;
      let isCropActive = state.isCropActive;
      if (tool === 'crop') {
        isCropActive = true;
      } else if (prev === 'crop') {
        isCropActive = false;
      }
      return { activeTool: tool, isCropActive };
    }),
  addAudioTrack: (type, file) =>
    set((state) => {
      const d = state.duration;
      const id = nanoid();
      const src = URL.createObjectURL(file);
      let startTime = 0;
      let endTime = d > 0 ? d : 0;
      if (d > 0 && endTime - startTime < MIN_VIDEO_CLIP_SEC) {
        endTime = Math.min(d, startTime + MIN_VIDEO_CLIP_SEC);
      }
      const track: AudioTrack = {
        id,
        type,
        name: file.name,
        src,
        startTime,
        endTime,
        volume: 80,
        isMuted: false,
        fadeIn: 0,
        fadeOut: 0,
        audioBuffer: null,
      };
      return {
        audioTracks: [...state.audioTracks, track],
        selectedAudioTrackId: id,
      };
    }),
  updateAudioTrack: (id, patch) =>
    set((state) => {
      const d = state.duration;
      return {
        audioTracks: state.audioTracks.map((t) => {
          if (t.id !== id) return t;
          const next = { ...t, ...patch };
          if (d > 0) {
            let start = Math.max(0, next.startTime);
            let end = Math.min(d, next.endTime);
            if (end - start < MIN_VIDEO_CLIP_SEC) {
              end = Math.min(d, start + MIN_VIDEO_CLIP_SEC);
              start = Math.max(0, end - MIN_VIDEO_CLIP_SEC);
            }
            next.startTime = start;
            next.endTime = end;
          }
          return next;
        }),
      };
    }),
  deleteAudioTrack: (id) =>
    set((state) => {
      const t = state.audioTracks.find((x) => x.id === id);
      if (t?.src.startsWith('blob:')) {
        URL.revokeObjectURL(t.src);
      }
      return {
        audioTracks: state.audioTracks.filter((x) => x.id !== id),
        selectedAudioTrackId:
          state.selectedAudioTrackId === id ? null : state.selectedAudioTrackId,
      };
    }),
  setOriginalAudioMuted: (v) => set({ originalAudioMuted: v }),
  setOriginalAudioVolume: (v) =>
    set({
      originalAudioVolume: Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0)),
    }),
  setSelectedAudioTrackId: (id) => set({ selectedAudioTrackId: id }),
  setAudioTrackBuffer: (id, buffer) =>
    set((state) => ({
      audioTracks: state.audioTracks.map((t) =>
        t.id === id ? { ...t, audioBuffer: buffer } : t,
      ),
    })),
  splitVideoAtPlayhead: () =>
    set((state) => {
      const d = state.duration;
      if (d <= 0) return {};
      const tRaw = state.currentTime;
      const MIN = MIN_VIDEO_CLIP_SEC;
      let segments = [...state.videoTimelineSegments].sort(
        (a, b) => a.startTime - b.startTime,
      );
      if (segments.length === 0) {
        segments = [
          {
            id: MAIN_VIDEO_TIMELINE_CLIP_ID,
            startTime: state.trimStart,
            endTime: state.trimEnd,
          },
        ];
      }
      const t = Math.min(Math.max(tRaw, MIN), d - MIN);
      const idx = segments.findIndex(
        (s) => t > s.startTime + 1e-4 && t < s.endTime - 1e-4,
      );
      if (idx < 0) return {};
      const s = segments[idx];
      if (s.endTime - s.startTime < 2 * MIN + 1e-4) return {};
      const split = Math.min(Math.max(t, s.startTime + MIN), s.endTime - MIN);
      const left: VideoTimelineSegment = {
        id: s.id,
        startTime: s.startTime,
        endTime: split,
      };
      const right: VideoTimelineSegment = {
        id: nanoid(),
        startTime: split,
        endTime: s.endTime,
      };
      segments.splice(idx, 1, left, right);
      return {
        videoTimelineSegments: segments,
        trimStart: 0,
        trimEnd: d,
        currentTime: split,
      };
    }),
  updateVideoTimelineSegment: (id, patch) =>
    set((state) => {
      const d = state.duration;
      if (d <= 0) return {};
      const MIN = MIN_VIDEO_CLIP_SEC;
      const segs = [...state.videoTimelineSegments].sort(
        (a, b) => a.startTime - b.startTime,
      );
      const i = segs.findIndex((s) => s.id === id);
      if (i < 0) return {};
      let start = patch.startTime ?? segs[i].startTime;
      let end = patch.endTime ?? segs[i].endTime;
      start = Math.max(0, start);
      end = Math.min(d, end);
      const prev = segs[i - 1];
      const next = segs[i + 1];
      if (prev) start = Math.max(start, prev.startTime + MIN);
      if (next) end = Math.min(end, next.endTime - MIN);
      if (end - start < MIN) return {};
      const out = [...segs];
      out[i] = { ...out[i], startTime: start, endTime: end };
      if (prev) out[i - 1] = { ...prev, endTime: start };
      if (next) out[i + 1] = { ...next, startTime: end };
      const fullCover =
        out.length > 0 &&
        out[0].startTime <= 1e-4 &&
        out[out.length - 1].endTime >= d - 1e-4;
      const trimStart = fullCover ? 0 : out[0].startTime;
      const trimEnd = fullCover ? d : out[out.length - 1].endTime;
      let currentTime = state.currentTime;
      if (currentTime < trimStart) currentTime = trimStart;
      if (currentTime > trimEnd) currentTime = trimEnd;
      if (out.length > 1) {
        currentTime = clampTimeToVideoSegments(currentTime, out, d);
      }
      return {
        videoTimelineSegments: out,
        trimStart,
        trimEnd,
        currentTime,
      };
    }),
  deleteVideoTimelineSegment: (id) =>
    set((state) => {
      const d = state.duration;
      if (d <= 0) return {};
      let segs = [...state.videoTimelineSegments].sort(
        (a, b) => a.startTime - b.startTime,
      );
      if (segs.length === 0) {
        segs = [
          {
            id: MAIN_VIDEO_TIMELINE_CLIP_ID,
            startTime: state.trimStart,
            endTime: state.trimEnd,
          },
        ];
      }
      if (segs.length <= 1) return {};
      if (!segs.some((s) => s.id === id)) return {};
      const out = segs.filter((s) => s.id !== id);
      if (out.length === 0) return {};
      if (out.length === 1 && out[0].id !== MAIN_VIDEO_TIMELINE_CLIP_ID) {
        out[0] = { ...out[0], id: MAIN_VIDEO_TIMELINE_CLIP_ID };
      }
      const fullCover =
        out.length > 0 &&
        out[0].startTime <= 1e-4 &&
        out[out.length - 1].endTime >= d - 1e-4;
      const trimStart = fullCover ? 0 : out[0].startTime;
      const trimEnd = fullCover ? d : out[out.length - 1].endTime;
      const currentTime = clampTimeToVideoSegments(state.currentTime, out, d);
      return {
        videoTimelineSegments: out,
        trimStart,
        trimEnd,
        currentTime,
      };
    }),
}));
