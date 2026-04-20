/** Format seconds as MM:SS or H:MM:SS when >= 1 hour. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(sec)}`;
  }
  return `${m}:${pad(sec)}`;
}

/** Short duration label (e.g. segment length). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#EF9F27';
  if (score >= 80) return '#7F77DD';
  if (score >= 70) return '#1D9E75';
  return '#666';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Viral';
  if (score >= 80) return 'High';
  if (score >= 70) return 'Good';
  return 'Fair';
}

/** Append `#t=` seek hash without duplicating existing hash. */
export function withVideoSeekHash(videoUrl: string, startSeconds: number): string {
  const base = videoUrl.split('#')[0] ?? videoUrl;
  return `${base}#t=${startSeconds}`;
}
