/** Source-file time spans for workspace video timeline (seconds). */
export type VideoSegmentSpan = { startTime: number; endTime: number };

export function sortVideoSegments<T extends VideoSegmentSpan>(segments: T[]): T[] {
  return [...segments].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Keeps playhead inside an allowed segment; in gaps between segments, snaps to the nearest
 * segment boundary (midpoint split).
 */
export function clampTimeToVideoSegments(
  t: number,
  segments: VideoSegmentSpan[],
  duration: number,
): number {
  const sorted = sortVideoSegments(segments);
  if (sorted.length === 0) {
    return Math.min(Math.max(t, 0), Math.max(0, duration));
  }
  if (sorted.length === 1) {
    const s = sorted[0];
    return Math.min(Math.max(t, s.startTime), s.endTime);
  }
  for (const s of sorted) {
    if (t + 1e-4 >= s.startTime && t - 1e-4 <= s.endTime) {
      return Math.min(Math.max(t, s.startTime), s.endTime);
    }
  }
  if (t < sorted[0].startTime) return sorted[0].startTime;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t > a.endTime && t < b.startTime) {
      const mid = (a.endTime + b.startTime) / 2;
      return t < mid ? a.endTime : b.startTime;
    }
  }
  const last = sorted[sorted.length - 1];
  if (t > last.endTime) return last.endTime;
  return t;
}
