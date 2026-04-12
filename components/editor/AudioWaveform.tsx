'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

const BUCKET_COUNT = 120;
const PLAYED_COLOR = '#7F77DD';
const UPCOMING_COLOR = '#EF9F27';

/**
 * Canvas waveform from `audioBuffer` in Zustand — 120 buckets, mean |amplitude| per bucket.
 */
export function AudioWaveform() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[] | null>(null);

  const audioBuffer = useEditorStore((s) => s.audioBuffer);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);

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

    for (let i = 0; i < BUCKET_COUNT; i++) {
      const tMid = (i + 0.5) / BUCKET_COUNT;
      ctx.fillStyle = tMid < progress ? PLAYED_COLOR : UPCOMING_COLOR;
      const amp = peaks[i] ?? 0;
      const barH = amp * maxBarH;
      const x = i * slotW + (slotW - barW) / 2;
      ctx.fillRect(x, centerY - barH / 2, barW, barH);
    }
  }, []);

  useEffect(() => {
    draw();
  }, [currentTime, duration, draw]);

  useEffect(() => {
    draw();
  }, [audioBuffer, draw]);

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
