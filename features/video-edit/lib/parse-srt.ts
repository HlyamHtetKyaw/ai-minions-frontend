export type SrtCue = {
  startTime: number;
  endTime: number;
  content: string;
};

function parseSrtTimestamp(s: string): number {
  const normalized = s.trim().replace(',', '.');
  const m = normalized.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{1,3})$/);
  if (!m) return 0;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const frac = m[4]!;
  const ms = Number(frac.padEnd(3, '0').slice(0, 3));
  if (![hh, mm, ss, ms].every(Number.isFinite)) return 0;
  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

/**
 * Minimal SRT parser: index line (optional), timestamp line, then cue text until blank block.
 */
export function parseSrt(raw: string): SrtCue[] {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    let i = 0;
    if (/^\d+$/.test(lines[i]!.trim())) {
      i += 1;
    }

    const timeLine = lines[i];
    if (!timeLine) continue;

    const tm = timeLine.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{1,3})/,
    );
    if (!tm) continue;

    i += 1;
    const content = lines.slice(i).join('\n').trim();
    const startTime = parseSrtTimestamp(tm[1]!);
    const endTime = parseSrtTimestamp(tm[2]!);

    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
    cues.push({
      startTime,
      endTime: Math.max(endTime, startTime),
      content,
    });
  }

  return cues;
}
