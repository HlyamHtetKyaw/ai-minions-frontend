'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { VideoSegment } from '@/store/editorStore';

const BUCKET_COUNT = 120;
const PLAYED_COLOR = '#7F77DD';
const UPCOMING_COLOR = '#EF9F27';

/**
 * Canvas waveform from `audioBuffer` in Zustand — 120 buckets, mean |amplitude| per bucket.
 */
type AudioWaveformProps = {
  segment?: VideoSegment;
};

export function AudioWaveform({ segment }: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[] | null>(null);

  const audioBuffer = useEditorStore((s) => s.audioBuffer);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const videoSegments = useEditorStore((s) => s.videoSegments);

  useEffect(() => {
    if (!audioBuffer) {
      peaksRef.current = null;
      return;
    }

    const ch = audioBuffer.getChannelData(0);
    const len = ch.length;
    const avgs: number[] = [];

    for (let b = 0; b < BUCKET_COUNT; b++) {
      const start = Math.floor((b / BUCKET_COUNT) * len);
      const end = Math.floor(((b + 1) / BUCKET_COUNT) * len);
      const n = Math.max(1, end - start);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += Math.abs(ch[j] ?? 0);
      }
      avgs.push(sum / n);
    }

    const max = Math.max(...avgs, 1e-8);
    peaksRef.current = avgs.map((a) => a / max);
  }, [audioBuffer]);

  const draw = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const peaks = peaksRef.current;
    const buf = useEditorStore.getState().audioBuffer;
    const t = useEditorStore.getState().currentTime;
    const dur = useEditorStore.getState().duration;

    if (!container || !canvas || !buf || !peaks || peaks.length !== BUCKET_COUNT) {
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

    const progress = dur > 0 && Number.isFinite(dur) ? Math.min(1, Math.max(0, t / dur)) : 0;
    const slotW = cssW / BUCKET_COUNT;
    const barW = Math.max(1, slotW - 1);
    const centerY = cssH / 2;
    const maxBarH = cssH * 0.9;
    const segStartRatio = segment != null ? Math.max(0, Math.min(1, segment.startTime / dur)) : 0;
    const segEndRatio = segment != null ? Math.max(0, Math.min(1, segment.endTime / dur)) : 1;
    const segStartBucket = Math.max(0, Math.floor(segStartRatio * BUCKET_COUNT));
    const segEndBucket = Math.min(BUCKET_COUNT, Math.ceil(segEndRatio * BUCKET_COUNT));
    const segmentVolume = segment != null ? segment.volume / 100 : 1;
    const segmentOpacity = segment?.isMuted ? 0.2 : 1;

    for (let i = 0; i < BUCKET_COUNT; i++) {
      if (segment != null && (i < segStartBucket || i >= segEndBucket)) continue;
      const tMid = (i + 0.5) / BUCKET_COUNT;
      ctx.fillStyle = tMid < progress ? PLAYED_COLOR : UPCOMING_COLOR;
      ctx.globalAlpha = segmentOpacity;
      const amp = peaks[i] ?? 0;
      const barH = amp * maxBarH * segmentVolume;
      const x = i * slotW + (slotW - barW) / 2;
      ctx.fillRect(x, centerY - barH / 2, barW, barH);
    }
    ctx.globalAlpha = 1;

    if (segment == null && dur > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      for (const seg of videoSegments) {
        const x1 = (seg.startTime / dur) * cssW;
        const x2 = (seg.endTime / dur) * cssW;
        if (x2 <= x1) continue;
        const volumeLevel = seg.isMuted ? 0 : seg.volume / 100;
        const y = (1 - volumeLevel) * cssH;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();

        const fadeInWidth = seg.fadeIn > 0 ? Math.min((seg.fadeIn / dur) * cssW, x2 - x1) : 0;
        if (fadeInWidth > 0) {
          ctx.beginPath();
          ctx.moveTo(x1, 0);
          ctx.lineTo(x1 + fadeInWidth, y);
          ctx.stroke();
        }

        const fadeOutWidth = seg.fadeOut > 0 ? Math.min((seg.fadeOut / dur) * cssW, x2 - x1) : 0;
        if (fadeOutWidth > 0) {
          ctx.beginPath();
          ctx.moveTo(x2 - fadeOutWidth, y);
          ctx.lineTo(x2, 0);
          ctx.stroke();
        }
      }
    }
  }, [segment, videoSegments]);

  useEffect(() => {
    draw();
  }, [currentTime, duration, draw, segment, videoSegments]);

  useEffect(() => {
    draw();
  }, [audioBuffer, draw, segment, videoSegments]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  if (audioBuffer == null) {
    return (
      <div className="flex h-full min-h-[22px] w-full items-center justify-center rounded-sm bg-zinc-900/80 ring-1 ring-zinc-700/60">
        <span className="text-[10px] text-zinc-500">extracting waveform...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[22px] w-full min-w-0 overflow-hidden rounded-sm bg-zinc-900/80 ring-1 ring-zinc-700/60"
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  );
}
