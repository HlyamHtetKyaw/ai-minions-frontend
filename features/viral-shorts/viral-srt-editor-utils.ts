import type { SrtCue } from '@/features/video-edit/lib/parse-srt';
import { subtitlesPositionFromTextLayer } from '@/lib/buildWorkspaceSrtBurnFromLayers';
import type { TextLayer } from '@/store/editorStore';

export type EditableSrtCue = SrtCue & { id: string };

function pad2(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(2, '0');
}

function pad3(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(3, '0');
}

export function formatSrtTimestamp(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.round(s * 1000);
  const hh = Math.floor(totalMs / 3600_000);
  const mm = Math.floor((totalMs % 3600_000) / 60_000);
  const ss = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${pad3(ms)}`;
}

export function parseTimeInput(raw: string): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const parts = t.split(':').map((p) => p.trim());
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map((p) => Number(p.replace(',', '.')));
    if (!nums.every(Number.isFinite)) return null;
    const [a, b, c] = nums;
    if (parts.length === 2) {
      return (a ?? 0) * 60 + (b ?? 0);
    }
    return (a ?? 0) * 3600 + (b ?? 0) * 60 + (c ?? 0);
  }
  const m = t.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    const ms = Number(String(m[4]).padEnd(3, '0').slice(0, 3));
    if (![hh, mm, ss, ms].every(Number.isFinite)) return null;
    return hh * 3600 + mm * 60 + ss + ms / 1000;
  }
  return null;
}

export function getSrtImportLayers(textLayers: TextLayer[]): TextLayer[] {
  return textLayers
    .filter((l) => l.srtImportBatchId)
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
}

export function layersToEditableCues(layers: TextLayer[]): EditableSrtCue[] {
  return getSrtImportLayers(layers).map((l) => ({
    id: l.id,
    startTime: l.startTime,
    endTime: l.endTime,
    content: l.content,
  }));
}

export function getSrtStyleLayer(textLayers: TextLayer[]): TextLayer | null {
  const sorted = getSrtImportLayers(textLayers);
  return sorted[0] ?? null;
}

export function normalizedPositionFromSrtLayers(
  textLayers: TextLayer[],
  frameW: number,
  frameH: number,
): { x: number; y: number } {
  const layer = getSrtStyleLayer(textLayers);
  if (!layer || frameW <= 0 || frameH <= 0) return { x: 0.5, y: 0.88 };
  return subtitlesPositionFromTextLayer(layer, frameW, frameH);
}

export function positionPatchFromNormalized(
  pos: { x: number; y: number },
  refLayer: TextLayer,
  frameW: number,
  frameH: number,
): Partial<TextLayer> {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const cx = pos.x * fw;
  const cy = pos.y * fh;
  return {
    x: Math.round(cx - refLayer.width / 2),
    y: Math.round(cy - refLayer.height / 2),
  };
}
