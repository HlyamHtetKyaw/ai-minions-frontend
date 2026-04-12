'use client';

import { useCallback, useEffect, useRef } from 'react';
import { VolumeX } from 'lucide-react';
import type { AudioTrack } from '@/store/editorStore';

const BAR_COUNT = 100;
const MUSIC = '#1D9E75';
const VOICE = '#378ADD';

type AudioTrackWaveformProps = {
  track: AudioTrack;
  duration: number;
  isSelected: boolean;
};

/**
 * Single-color bar waveform from `track.audioBuffer` (Canvas), 100 bars, peak-normalized.
 */
export function AudioTrackWaveform({ track, duration, isSelected }: AudioTrackWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[] | null>(null);

  const color = track.type === 'voiceover' ? VOICE : MUSIC;

  useEffect(() => {
    const buf = track.audioBuffer;
    if (!buf) {
      peaksRef.current = null;
      return;
    }

    const ch = buf.getChannelData(0);
    const len = ch.length;
    const peaks: number[] = [];
    let maxPeak = 1e-8;

    for (let b = 0; b < BAR_COUNT; b++) {
      const start = Math.floor((b / BAR_COUNT) * len);
      const end = Math.floor(((b + 1) / BAR_COUNT) * len);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j] ?? 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > maxPeak) maxPeak = peak;
    }

    peaksRef.current = peaks.map((p) => p / maxPeak);
  }, [track.audioBuffer]);

  const draw = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const peaks = peaksRef.current;
    const buf = track.audioBuffer;

    if (!container || !canvas || !buf || !peaks || peaks.length !== BAR_COUNT) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const slotW = cssW / BAR_COUNT;
    const barW = Math.max(1, slotW - 1);
    const centerY = cssH / 2;
    const maxBarH = cssH * 0.88;
    const opacity = track.isMuted ? 0.3 : 1;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    for (let i = 0; i < BAR_COUNT; i++) {
      const amp = peaks[i] ?? 0;
      const barH = amp * maxBarH;
      const x = i * slotW + (slotW - barW) / 2;
      ctx.fillRect(x, centerY - barH / 2, barW, barH);
    }
    ctx.globalAlpha = 1;
  }, [track.audioBuffer, track.isMuted, color]);

  useEffect(() => {
    draw();
  }, [draw, duration]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  if (track.audioBuffer == null) {
    return (
      <div className="flex h-full min-h-[22px] w-full items-center justify-center rounded-sm bg-black/40 px-1">
        <span className="text-[9px] text-zinc-500">extracting...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[22px] w-full min-w-0 overflow-hidden rounded-sm"
      style={{
        boxSizing: 'border-box',
        border: isSelected ? `2px solid ${color}` : '2px solid transparent',
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      {track.isMuted && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <VolumeX className="h-4 w-4 text-zinc-200" strokeWidth={2} aria-hidden />
        </div>
      )}
    </div>
  );
}
