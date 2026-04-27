/** Source-file spans (seconds) kept for workspace export / preview. */
export type ExportVideoSegment = { startTime: number; endTime: number };

const EPS = 1e-6;

export function normalizeExportVideoSegments(
  timeline: ExportVideoSegment[] | null | undefined,
  trimStart: number,
  trimEnd: number,
  duration: number,
): ExportVideoSegment[] {
  const d = Math.max(0, duration);
  const list =
    timeline != null && timeline.length > 0
      ? [...timeline]
      : [
          {
            startTime: Math.max(0, trimStart),
            endTime: trimEnd > trimStart ? trimEnd : d > 0 ? d : Math.max(0, trimStart),
          },
        ];
  const sorted = list
    .filter((s) => Number.isFinite(s.startTime) && Number.isFinite(s.endTime) && s.endTime > s.startTime + EPS)
    .map((s) => ({
      startTime: Math.max(0, s.startTime),
      endTime: Math.min(d > 0 ? d : s.endTime, s.endTime),
    }))
    .filter((s) => s.endTime > s.startTime + EPS)
    .sort((a, b) => a.startTime - b.startTime);

  if (sorted.length === 0) {
    const t0 = Math.max(0, trimStart);
    const t1 = trimEnd > t0 ? trimEnd : d > 0 ? d : t0;
    return t1 > t0 + EPS ? [{ startTime: t0, endTime: t1 }] : [{ startTime: 0, endTime: Math.max(EPS, d || EPS) }];
  }

  const merged: ExportVideoSegment[] = [];
  for (const s of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev || s.startTime > prev.endTime + EPS) {
      merged.push({ ...s });
    } else {
      prev.endTime = Math.max(prev.endTime, s.endTime);
    }
  }
  return merged;
}

export function exportDurationFromSegments(segments: ExportVideoSegment[], speed: number): number {
  const safeSpeed = Math.abs(speed) < EPS ? 1 : speed;
  let sum = 0;
  for (const s of segments) {
    sum += Math.max(0, s.endTime - s.startTime);
  }
  return Math.max(0.01, sum / safeSpeed);
}

/** Absolute source time → exported timeline (0 = first kept frame), or null if before first kept region. */
export function sourceTimeToExportTime(
  sourceT: number,
  segments: ExportVideoSegment[],
  speed: number,
): number | null {
  if (!Number.isFinite(sourceT)) return null;
  const safeSpeed = Math.abs(speed) < EPS ? 1 : speed;
  let acc = 0;
  for (const s of segments) {
    if (sourceT <= s.startTime + EPS) return acc;
    if (sourceT < s.endTime - EPS) {
      return acc + (sourceT - s.startTime) / safeSpeed;
    }
    acc += (s.endTime - s.startTime) / safeSpeed;
  }
  return acc;
}

/**
 * Map a [start,end) interval on the source clock into one or more intervals on the export clock
 * (after trim gaps removed and speed applied).
 */
export function sourceIntervalToExportIntervals(
  sourceStart: number,
  sourceEnd: number,
  segments: ExportVideoSegment[],
  speed: number,
  exportedDuration: number,
): { start: number; end: number }[] {
  if (!(sourceEnd > sourceStart + EPS)) return [];
  const out: { start: number; end: number }[] = [];
  for (const s of segments) {
    const clipStart = Math.max(sourceStart, s.startTime);
    const clipEnd = Math.min(sourceEnd, s.endTime);
    if (!(clipEnd > clipStart + EPS)) continue;
    const t0 = sourceTimeToExportTime(clipStart, segments, speed);
    const t1 = sourceTimeToExportTime(clipEnd, segments, speed);
    if (t0 == null || t1 == null) continue;
    const startOut = Math.max(0, t0);
    let endOut = Math.max(startOut + 0.02, t1);
    endOut = Math.min(exportedDuration, endOut);
    if (endOut > startOut + EPS) {
      out.push({ start: startOut, end: endOut });
    }
  }
  return out;
}
