'use client';

import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useEditorStore } from '@/store/editorStore';

type WorkspaceVideoWaveformProps = {
  className?: string;
};

/**
 * Timeline waveform (wavesurfer.js). Must NOT use `media: <video>` — that binds WaveSurfer to the
 * same element as the canvas and causes play()/pause() fights (see https://goo.gl/LdLk22).
 * We decode from `url` (same blob) and only mirror time with `setTime` from the real video.
 */
export function WorkspaceVideoWaveform({ className }: WorkspaceVideoWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoSrc = useEditorStore((s) => s.videoSrc);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoSrc) return;

    let cancelled = false;
    let ws: WaveSurfer | null = null;
    let attachedVideo: HTMLVideoElement | null = null;
    let unsubscribeStore: (() => void) | undefined;

    const syncFromVideo = () => {
      const v = useEditorStore.getState().videoElement;
      if (!v || !ws) return;
      try {
        ws.setTime(v.currentTime);
      } catch {
        /* WaveSurfer not ready */
      }
    };

    const attachVideo = (v: HTMLVideoElement | null) => {
      if (!v) return;
      if (attachedVideo === v) return;
      if (attachedVideo) {
        attachedVideo.removeEventListener('timeupdate', syncFromVideo);
        attachedVideo.removeEventListener('seeking', syncFromVideo);
      }
      attachedVideo = v;
      v.addEventListener('timeupdate', syncFromVideo);
      v.addEventListener('seeking', syncFromVideo);
    };

    const detachVideo = () => {
      if (attachedVideo) {
        attachedVideo.removeEventListener('timeupdate', syncFromVideo);
        attachedVideo.removeEventListener('seeking', syncFromVideo);
        attachedVideo = null;
      }
    };

    const frame = requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) return;

      const WAVE_H = 40;

      ws = WaveSurfer.create({
        container: containerRef.current,
        url: videoSrc,
        height: WAVE_H,
        waveColor: '#fde047',
        progressColor: 'rgba(124, 58, 237, 0.85)',
        cursorWidth: 0,
        interact: false,
        fillParent: true,
        hideScrollbar: true,
        normalize: true,
        autoScroll: false,
        autoCenter: false,
        sampleRate: 44100,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        barAlign: 'bottom',
        barMinHeight: 2,
      });

      ws.once('ready', () => {
        if (cancelled || !ws) return;
        try {
          const el = ws.getMediaElement();
          el.muted = true;
          el.volume = 0;
          el.pause();
        } catch {
          /* noop */
        }
        syncFromVideo();
        attachVideo(useEditorStore.getState().videoElement);
        try {
          ws.setOptions({ height: WAVE_H });
        } catch {
          /* noop */
        }
      });

      ws.on('error', (err) => {
        // Teardown / `videoSrc` changes call `destroy()`, which aborts the decode fetch — expected.
        const name =
          err != null && typeof err === 'object' && 'name' in err
            ? String((err as { name: unknown }).name)
            : '';
        if (name === 'AbortError') return;
        console.warn('[WaveSurfer]', err);
      });

      unsubscribeStore = useEditorStore.subscribe((state, prev) => {
        const v = state.videoElement;
        if (v && v !== prev.videoElement) {
          attachVideo(v);
          syncFromVideo();
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      detachVideo();
      try {
        unsubscribeStore?.();
      } catch {
        /* noop */
      }
      try {
        ws?.destroy();
      } catch {
        /* noop */
      }
      ws = null;
    };
  }, [videoSrc]);

  return (
    <div
      ref={containerRef}
      className={`timeline-waveform-host min-h-[40px] w-full min-w-[40px] bg-[#1e1033] ${className ?? ''}`}
      aria-hidden
    />
  );
}
