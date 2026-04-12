import type { EditorState } from '@/store/editorStore';

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
  const scaleX =
    state.canvasFrameWidth > 0 && state.videoNaturalWidth > 0
      ? state.videoNaturalWidth / state.canvasFrameWidth
      : 1;
  const scaleY =
    state.canvasFrameHeight > 0 && state.videoNaturalHeight > 0
      ? state.videoNaturalHeight / state.canvasFrameHeight
      : 1;

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
   */

  return {
    videoUrl: state.videoSrc,
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
    speed: state.playbackSpeed,
    crop: state.cropSettings,
    textLayers: state.textLayers.map((l) => ({
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
    imageLayers: state.imageLayers.map((l) => ({
      id: l.id,
      src: l.src,
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
    })),
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
    originalAudio: {
      muted: state.originalAudioMuted,
      volume: state.originalAudioVolume,
    },
    /** Multiply display-space crop/layer pixels by these to get natural video pixels for FFmpeg. */
    displayToNaturalScale: { x: scaleX, y: scaleY },
    canvasFrame: {
      width: state.canvasFrameWidth,
      height: state.canvasFrameHeight,
    },
    naturalVideo: {
      width: state.videoNaturalWidth,
      height: state.videoNaturalHeight,
    },
  };
}
