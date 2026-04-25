import type { TextLayer } from '@/store/editorStore';
import {
  exportDurationFromSegments,
  normalizeExportVideoSegments,
  sourceIntervalToExportIntervals,
} from '@/lib/exportVideoSegments';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** SRT timestamp (hours:minutes:seconds,ms). */
export function formatSrtTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, '0')}`;
}

export type WorkspaceSrtBurnParams = {
  /** Inclusive end of kept segment (source seconds); if not after trimStart, duration is used on caller side. */
  trimStart: number;
  trimEnd: number;
  duration: number;
  speed: number;
  /** When set (multi-segment / middle trim), export uses these spans on the source clock; gaps are removed. */
  videoTimelineSegments?: { startTime: number; endTime: number }[];
};

/** Mirrors backend `WorkspaceExportService` trim / speed segment math for one place of truth on the client. */
export function workspaceExportTrimWindow(params: WorkspaceSrtBurnParams): {
  t0: number;
  t1: number;
  safeSpeed: number;
  exportedDuration: number;
  /** Normalized kept source spans; used for multi-segment SRT shift. */
  segments: { startTime: number; endTime: number }[];
} {
  const { trimStart, trimEnd, duration, speed, videoTimelineSegments } = params;
  const safeSpeed = Math.abs(speed) < 1e-6 ? 1 : speed;
  const d = Math.max(0, duration);
  const segments = normalizeExportVideoSegments(videoTimelineSegments, trimStart, trimEnd, d);
  const t0 = segments.length > 0 ? segments[0].startTime : Math.max(0, trimStart);
  const t1 =
    segments.length > 0
      ? segments[segments.length - 1].endTime
      : trimEnd > t0
        ? trimEnd
        : d > 0
          ? d
          : t0;
  const exportedDuration = exportDurationFromSegments(segments, safeSpeed);
  return { t0, t1, safeSpeed, exportedDuration, segments };
}

/**
 * Build SRT text for the viral-style burn pipeline (`burnSubtitles` + `subtitlesSrtText`),
 * with cue times on the **exported** timeline (0 = start of trimmed clip, after speed).
 */
export function buildShiftedSrtFromImportedTextLayers(
  textLayers: TextLayer[],
  params: WorkspaceSrtBurnParams,
): string | null {
  const imported = textLayers.filter((l) => l.srtImportBatchId);
  if (imported.length === 0) return null;

  const { t0, t1, safeSpeed, exportedDuration, segments } = workspaceExportTrimWindow(params);

  const sorted = [...imported].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.id.localeCompare(b.id);
  });

  const blocks: string[] = [];
  let index = 1;

  for (const layer of sorted) {
    const rawStart = layer.startTime;
    const rawEnd = layer.endTime;
    if (!(rawEnd > t0 && rawStart < t1)) continue;

    const intervals = sourceIntervalToExportIntervals(
      rawStart,
      rawEnd,
      segments,
      safeSpeed,
      exportedDuration,
    );

    for (const { start: startOut, end: endOut } of intervals) {
      if (!(endOut > startOut)) continue;

      const body = (layer.content ?? '').replace(/\r\n/g, '\n').trimEnd();
      const text = body.length > 0 ? body : ' ';

      blocks.push(
        `${index}\n${formatSrtTimestamp(startOut)} --> ${formatSrtTimestamp(endOut)}\n${text}\n`,
      );
      index += 1;
    }
  }

  if (blocks.length === 0) return null;
  return `${blocks.join('\n')}\n`;
}

/** Normalized (0–1) anchor for `subtitlesPosition`, from a text layer box (viral burn uses this for \\pos). */
export function subtitlesPositionFromTextLayer(
  layer: TextLayer,
  frameW: number,
  frameH: number,
): { x: number; y: number } {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const cx = (layer.x + Math.max(0, layer.width) / 2) / fw;
  const cy = (layer.y + Math.max(0, layer.height) / 2) / fh;
  return {
    x: Math.max(0, Math.min(1, cx)),
    y: Math.max(0, Math.min(1, cy)),
  };
}
