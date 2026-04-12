'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { AudioTrack } from '@/store/editorStore';

type NodePair = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

function scheduleTrackGain(
  gainParam: AudioParam,
  ctxNow: number,
  videoT: number,
  track: AudioTrack,
  ps: number,
) {
  const base = track.isMuted ? 0 : track.volume / 100;
  gainParam.cancelScheduledValues(ctxNow);
  if (base <= 0) {
    gainParam.setValueAtTime(0, ctxNow);
    return;
  }

  const { startTime: st, endTime: en, fadeIn: fi, fadeOut: fo } = track;
  const vAt = (vt: number) => ctxNow + Math.max(0, (vt - videoT) / ps);

  const elapsed = videoT - st;
  const untilEnd = en - videoT;
  let g0 = base;
  if (fi > 0 && elapsed >= 0 && elapsed < fi) {
    g0 *= elapsed / fi;
  }
  if (fo > 0 && untilEnd >= 0 && untilEnd < fo) {
    g0 *= untilEnd / fo;
  }
  gainParam.setValueAtTime(g0, ctxNow);

  if (fi > 0 && videoT < st + fi) {
    gainParam.linearRampToValueAtTime(base, vAt(st + fi));
  }

  if (fo > 0 && untilEnd > 0) {
    const fs = en - fo;
    if (videoT < fs) {
      const tHold = vAt(fs);
      if (tHold > ctxNow) {
        gainParam.setValueAtTime(base, tHold);
      }
    }
    gainParam.linearRampToValueAtTime(0, vAt(en));
  }
}

/**
 * Mixes uploaded timeline audio via Web Audio API in sync with preview playback.
 * Recreates `AudioBufferSourceNode` instances whenever playback starts or after a seek while playing.
 */
export function useAudioPlayback() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<NodePair[]>([]);

  const stopAll = () => {
    for (const { source, gain } of nodesRef.current) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        /* */
      }
    }
    nodesRef.current = [];
  };

  const startFromCurrentTime = () => {
    const s = useEditorStore.getState();
    if (!s.isPlaying) {
      stopAll();
      return;
    }

    void (async () => {
      let ac = ctxRef.current;
      if (!ac || ac.state === 'closed') {
        ac = new AudioContext();
        ctxRef.current = ac;
      }
      try {
        await ac.resume();
      } catch {
        /* user may need another gesture */
      }

      const state = useEditorStore.getState();
      if (!state.isPlaying) return;

      const ps =
        state.playbackSpeed > 0 && Number.isFinite(state.playbackSpeed)
          ? state.playbackSpeed
          : 1;
      const T = state.currentTime;

      stopAll();

      for (const track of state.audioTracks) {
        if (!track.audioBuffer) continue;
        if (T >= track.endTime - 1e-4 || T < track.startTime - 1e-4) continue;

        const buf = track.audioBuffer;
        const bufferOffset = Math.max(0, T - track.startTime);
        if (bufferOffset >= buf.duration - 1e-6) continue;

        const timelineRemain = track.endTime - T;
        const bufferRemain = buf.duration - bufferOffset;
        const playDurationBuf = Math.min(bufferRemain, timelineRemain * ps);
        if (playDurationBuf <= 1e-5) continue;

        const source = ac.createBufferSource();
        source.buffer = buf;
        source.playbackRate.value = ps;

        const gainNode = ac.createGain();
        source.connect(gainNode);
        gainNode.connect(ac.destination);

        const ctxNow = ac.currentTime;
        scheduleTrackGain(gainNode.gain, ctxNow, T, track, ps);

        try {
          source.start(ctxNow, bufferOffset, playDurationBuf);
        } catch (e) {
          console.warn('[useAudioPlayback] source.start', e);
          try {
            source.disconnect();
            gainNode.disconnect();
          } catch {
            /* */
          }
          continue;
        }

        nodesRef.current.push({ source, gain: gainNode });
      }
    })();
  };

  useEffect(() => {
    if (useEditorStore.getState().isPlaying) {
      startFromCurrentTime();
    }

    const unsub = useEditorStore.subscribe((state, prev) => {
      const { isPlaying, currentTime, audioTracks, playbackSpeed } = state;
      const prevTime = prev.currentTime;

      if (isPlaying !== prev.isPlaying) {
        if (!isPlaying) {
          stopAll();
        } else {
          startFromCurrentTime();
        }
        return;
      }

      if (isPlaying) {
        if (audioTracks !== prev.audioTracks || playbackSpeed !== prev.playbackSpeed) {
          startFromCurrentTime();
          return;
        }
        const jump = Math.abs(currentTime - prevTime);
        if (jump > 0.12) {
          startFromCurrentTime();
        }
        return;
      }

      if (Math.abs(currentTime - prevTime) > 1e-4) {
        stopAll();
      }
    });

    return () => {
      unsub();
      stopAll();
      const ac = ctxRef.current;
      ctxRef.current = null;
      void ac?.close().catch(() => {
        /* */
      });
    };
  }, []);
}
