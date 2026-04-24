const LEGACY_NESTED_KEY = 'viralShortsWorkspace' as const;

/**
 * Parse viral workspace JSON returned by {@code GET /api/v1/viral-shorts/workspace} (dedicated store).
 * Supports legacy nested shape if present in migrated payloads.
 */
export function parseViralWorkspacePayloadForRestore(raw: string): Record<string, unknown> | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '{}' || trimmed === 'null') return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const nested = parsed[LEGACY_NESTED_KEY];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const url = (nested as { videoUrl?: unknown }).videoUrl ?? (nested as { videoSrc?: unknown }).videoSrc;
      if (typeof url === 'string' && url.trim()) {
        return nested as Record<string, unknown>;
      }
    }
    const flatUrl = parsed.videoUrl ?? parsed.videoSrc;
    if (typeof flatUrl === 'string' && flatUrl.trim()) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
