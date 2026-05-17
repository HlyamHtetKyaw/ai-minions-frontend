export const DEFAULT_CAPTION_BACKGROUND_COLOR = '#000000';
export const DEFAULT_SRT_BACKGROUND_OPACITY = 65;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function resolveCaptionBackgroundOpacity(layer: {
  backgroundOpacity?: number;
  srtImportBatchId?: string;
}): number {
  if (typeof layer.backgroundOpacity === 'number' && Number.isFinite(layer.backgroundOpacity)) {
    return clamp(Math.round(layer.backgroundOpacity), 0, 100);
  }
  if (layer.srtImportBatchId) return DEFAULT_SRT_BACKGROUND_OPACITY;
  return 0;
}

export function resolveCaptionBackgroundColor(layer: { backgroundColor?: string }): string {
  const raw = layer.backgroundColor?.trim();
  if (raw && /^#?[0-9A-Fa-f]{6}$/.test(raw)) {
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return DEFAULT_CAPTION_BACKGROUND_COLOR;
}

/** Preview CSS background for caption box behind text (undefined = transparent). */
export function captionBoxBackgroundCss(
  backgroundColor: string | undefined,
  backgroundOpacity: number | undefined,
): string | undefined {
  const opacity = clamp(
    typeof backgroundOpacity === 'number' && Number.isFinite(backgroundOpacity)
      ? Math.round(backgroundOpacity)
      : 0,
    0,
    100,
  );
  if (opacity <= 0) return undefined;
  const rgb = parseHexRgb(backgroundColor ?? DEFAULT_CAPTION_BACKGROUND_COLOR);
  if (!rgb) return `rgba(0, 0, 0, ${opacity / 100})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity / 100})`;
}
