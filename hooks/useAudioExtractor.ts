'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

/**
 * Fetches a blob URL (e.g. object URL for an uploaded audio file), decodes to `AudioBuffer`,
 * and closes the temporary `AudioContext`.
 */
export async function extractAudioFromBlob(
  src: string,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const audioCtx = new AudioContext();
  try {
    const response = await fetch(src, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try {
      await audioCtx.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fetches the video blob URL and decodes audio with the Web Audio API (no server).
 * Cancels in-flight work when `videoSrc` changes.
 * Also decodes uploaded timeline audio tracks for waveforms.
 */
export function useAudioExtractor() {
  const videoSrc = useEditorStore((s) => s.videoSrc);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const setAudioBuffer = useEditorStore((s) => s.setAudioBuffer);
  const setIsExtractingAudio = useEditorStore((s) => s.setIsExtractingAudio);
  const setAudioTrackBuffer = useEditorStore((s) => s.setAudioTrackBuffer);
  const isExtracting = useEditorStore((s) => s.isExtractingAudio);
  const inflightRef = useRef<Set<string>>(new Set());
  const trackAbortRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    if (videoSrc == null) {
      setAudioBuffer(null);
      setIsExtractingAudio(false);
      return;
    }

    const abortController = new AbortController();

    const run = async () => {
      setIsExtractingAudio(true);
      setAudioBuffer(null);

      const audioCtx = new AudioContext();

      try {
        const response = await fetch(videoSrc, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

        if (abortController.signal.aborted) return;

        setAudioBuffer(decoded);
      } catch (e) {
        if (abortController.signal.aborted) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('[useAudioExtractor]', e);
        setAudioBuffer(null);
      } finally {
        try {
          await audioCtx.close();
        } catch {
          /* ignore */
        }
        if (!abortController.signal.aborted) {
          setIsExtractingAudio(false);
        }
      }
    };

    void run();

    return () => {
      abortController.abort();
      setIsExtractingAudio(false);
    };
  }, [videoSrc, setAudioBuffer, setIsExtractingAudio]);

  useEffect(() => {
    const inflight = inflightRef.current;
    const abortById = trackAbortRef.current;
    const ids = new Set(audioTracks.map((t) => t.id));

    for (const id of [...abortById.keys()]) {
      if (!ids.has(id)) {
        abortById.get(id)?.abort();
        abortById.delete(id);
        inflight.delete(id);
      }
    }

    for (const track of audioTracks) {
      if (track.audioBuffer != null) continue;
      if (inflight.has(track.id)) continue;

      inflight.add(track.id);
      const ac = new AbortController();
      abortById.set(track.id, ac);
      const id = track.id;
      const src = track.src;
      const { signal } = ac;

      void extractAudioFromBlob(src, signal)
        .then((buffer) => {
          inflight.delete(id);
          abortById.delete(id);
          const still = useEditorStore.getState().audioTracks.some((t) => t.id === id);
          if (still) setAudioTrackBuffer(id, buffer);
        })
        .catch((e) => {
          inflight.delete(id);
          abortById.delete(id);
          if (signal.aborted) return;
          if (e instanceof DOMException && e.name === 'AbortError') return;
          console.error('[useAudioExtractor] track decode', e);
        });
    }
  }, [audioTracks, setAudioTrackBuffer]);

  return { isExtracting };
}
