/** M:SS.d style used in the workspace timecode display. */
export function formatWorkspaceTime(seconds: number): string {
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  const secStr = rem.toFixed(1);
  const [ints, dec] = secStr.split('.');
  return `${m}:${(ints ?? '0').padStart(2, '0')}.${dec ?? '0'}`;
}
