import type { EditorState } from '@/store/editorStore';
import {
  buildShiftedSrtFromImportedTextLayers,
  subtitlesPositionFromTextLayer,
  workspaceExportTrimWindow,
} from '@/lib/buildWorkspaceSrtBurnFromLayers';

/**
 * URL the export backend can fetch: not a browser-only `blob:` URL, and without the
 * `#wk=...` fragment used to track workspace object keys in the editor.
 */
export function resolveExportVideoUrl(videoSrc: string | null | undefined): string | null {
  if (videoSrc == null || typeof videoSrc !== 'string' || videoSrc.trim() === '') return null;
  if (videoSrc.startsWith('blob:')) return null;
  const base = videoSrc.split('#')[0]?.trim() ?? '';
  if (base === '') return null;
  if (/^https?:\/\//i.test(base)) return base;
  return null;
}

/**
 * Pure snapshot of editor data for FFmpeg / API export.
 *
 * Image overlays (GIF): animated GIFs preview in the browser, but the current export
 * pipeline treats GIF assets as a static first-frame image unless the server adds
 * explicit multi-frame handling.
 *
 * FFmpeg translation (per image layer, illustrative):
 *   -i image.png
 *   [N:v]scale=W:H,rotate=R*PI/180:fillcolor=none[imgN];
 *   flipX: insert hflip before tagging [imgN]
 *   flipY: insert vflip before tagging [imgN]
 *   opacity: format=rgba,colorchannelmixer=aa=OPACITY (OPACITY = 0–1)
 *   [base][imgN]overlay=X:Y:enable='between(t,startTime,endTime)'[base]
 */
export function buildExportPayload(state: EditorState) {
  /** Prefer measured video frame; fall back to layout canvas so export scale is not stuck at 1 when frame is 0. */
  const frameW =
    state.canvasFrameWidth > 0 ? state.canvasFrameWidth : Math.max(1, state.canvasSize.width || 1);
  const frameH =
    state.canvasFrameHeight > 0 ? state.canvasFrameHeight : Math.max(1, state.canvasSize.height || 1);
  const scaleX =
    frameW > 0 && state.videoNaturalWidth > 0 ? state.videoNaturalWidth / frameW : 1;
  const scaleY =
    frameH > 0 && state.videoNaturalHeight > 0 ? state.videoNaturalHeight / frameH : 1;

  const speed = state.playbackSpeed;
  const trimParams = {
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    duration: state.duration,
    speed,
    videoTimelineSegments: state.videoTimelineSegments.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  };
  const burnSrtText = buildShiftedSrtFromImportedTextLayers(state.textLayers, trimParams);
  const burnImportedSrt = burnSrtText != null && burnSrtText.trim().length > 0;
  const { t0, t1 } = workspaceExportTrimWindow(trimParams);
  const importedSorted = [...state.textLayers]
    .filter((l) => l.srtImportBatchId)
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const srtStyleLayer = burnImportedSrt
    ? (importedSorted.find((l) => l.endTime > t0 && l.startTime < t1) ?? importedSorted[0])
    : undefined;

  const canMapPreviewFont =
    frameW > 0 &&
    frameH > 0 &&
    srtStyleLayer != null &&
    Number.isFinite(srtStyleLayer.fontSize) &&
    srtStyleLayer.fontSize > 0;

  /*
   * FFmpeg translation (illustrative; input indices depend on your filter graph):
   *
   * Music track with fade in 1s and fade out 2s at 80% volume starting at 0:
   *   -i music.mp3
   *   [1:a]volume=0.8,afade=t=in:d=1,afade=t=out:st=28:d=2[music]
   *
   * Voiceover starting at 5 seconds into the video at 100% volume:
   *   -i voiceover.mp3
   *   [2:a]adelay=5000|5000,volume=1.0[voice]
   *
   * Original audio at 30% volume:
   *   [0:a]volume=0.3[orig]
   *
   * Final mix:
   *   [orig][music][voice]amix=inputs=3:normalize=0[aout]
   *
   * Replace original audio entirely (originalAudioMuted = true):
   *   [music][voice]amix=inputs=2:normalize=0[aout]
   *
   * Segment-based original audio:
   *   [0:a]atrim=start=0:end=10,volume=1.0,afade=t=in:d=0,afade=t=out:st=9:d=1[seg0];
   *   [0:a]atrim=start=10:end=20,volume=0.5[seg1];
   *   [0:a]atrim=start=20:end=30,volume=0.8,afade=t=in:d=2[seg2];
   *   [seg0][seg1][seg2]concat=n=3:v=0:a=1[origAudio];
   *   [1:a]music chain -> [musicAudio];
   *   [origAudio][musicAudio]amix=inputs=2:normalize=0[finalAudio]
   */

  return {
    videoUrl: resolveExportVideoUrl(state.videoSrc),
    duration: state.duration,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    trimmedDuration: Math.max(0, state.trimEnd - state.trimStart),
    videoTimelineSegments: state.videoTimelineSegments.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    trimApplyNonce: state.trimApplyNonce,
    speed,
    crop: state.cropSettings,
    textLayers: state.textLayers
      .filter((l) => !(burnImportedSrt && l.srtImportBatchId))
      .map((l) => ({
        id: l.id,
        content: l.content,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        fontSize: l.fontSize,
        fontFamily: l.fontFamily,
        color: l.color,
        opacity: l.opacity,
        startTime: l.startTime,
        endTime: l.endTime,
      })),
    blurLayers: state.blurLayers.map((l) => ({
      id: l.id,
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      intensity: l.intensity,
      startTime: l.startTime,
      endTime: l.endTime,
    })),
    imageLayers: state.imageLayers.map((l) => {
      let src = l.src;
      if (typeof src === 'string' && src.startsWith('blob:')) {
        const g = state.galleryImages.find((x) => x.id === l.galleryImageId);
        if (g != null && typeof g.src === 'string' && !g.src.startsWith('blob:')) {
          src = g.src;
        }
      }
      return {
        id: l.id,
        src,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        opacity: l.opacity / 100,
        rotation: l.rotation,
        flipX: l.flipX,
        flipY: l.flipY,
        startTime: l.startTime,
        endTime: l.endTime,
      };
    }),
    audioTracks: state.audioTracks.map((t) => ({
      id: t.id,
      type: t.type,
      src: t.src,
      startTime: t.startTime,
      endTime: t.endTime,
      volume: t.isMuted ? 0 : t.volume,
      fadeIn: t.fadeIn,
      fadeOut: t.fadeOut,
    })),
    videoSegments: state.videoSegments.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      volume: s.isMuted ? 0 : s.volume / 100,
      fadeIn: s.fadeIn,
      fadeOut: s.fadeOut,
    })),
    originalAudio: {
      muted: state.originalAudioMuted,
      volume: state.originalAudioVolume,
    },
    /** Multiply display-space crop/layer pixels by these to get natural video pixels for FFmpeg. */
    displayToNaturalScale: { x: scaleX, y: scaleY },
    canvasFrame: {
      width: frameW,
      height: frameH,
    },
    naturalVideo: {
      width: state.videoNaturalWidth,
      height: state.videoNaturalHeight,
    },
    // Viral-style SRT burn (ffmpeg subtitles → ASS + bundled font + FONTCONFIG); matches CreationStudio export.
    ...(burnImportedSrt && burnSrtText != null
      ? {
          burnSubtitles: true as const,
          subtitlesSrtText: burnSrtText,
          subtitlesPosition:
            srtStyleLayer != null
              ? subtitlesPositionFromTextLayer(srtStyleLayer, frameW, frameH)
              : { x: 0.5, y: 0.88 },
          subtitlesFontSize: Math.max(
            14,
            Math.min(60, Math.round(srtStyleLayer?.fontSize ?? 22)),
          ),
          ...(canMapPreviewFont && srtStyleLayer != null
            ? {
                subtitlesPreviewFontPx: srtStyleLayer.fontSize,
                subtitlesPreviewCanvasW: Math.round(frameW),
                subtitlesPreviewCanvasH: Math.round(frameH),
              }
            : {}),
          subtitlesBackgroundBlur: 0,
          // Preview text has no caption box (viral default 65% would burn a dark rectangle).
          subtitlesBackgroundOpacity: 0,
          /** Web hex (e.g. #22c55e); processing maps to ASS PrimaryColour. */
          subtitlesPrimaryColor:
            typeof srtStyleLayer?.color === 'string' && srtStyleLayer.color.trim() !== ''
              ? srtStyleLayer.color.trim()
              : '#ffffff',
        }
      : {}),
  };
}
