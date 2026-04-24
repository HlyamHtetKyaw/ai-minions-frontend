/**
 * Libass `FontSize` tends to read smaller than browser `font-size` (px) for the same nominal size,
 * especially with complex scripts. We apply this factor on top of the geometric canvas→output scale.
 */
export const SUBTITLE_PREVIEW_TO_BURN_FONT_FACTOR = 1.52;

/**
 * Maps subtitle font size between the preview canvas (CSS px) and FFmpeg/libass burn-in (output px).
 *
 * Forward (preview → burn):
 *   ffmpegFontPx = round(max(10, previewFontPx * max(scaleX, scaleY) * SUBTITLE_PREVIEW_TO_BURN_FONT_FACTOR))
 *   scaleX = outputVideoW / previewCanvasW, scaleY = outputVideoH / previewCanvasH
 *
 * Reverse (burn → preview):
 *   previewFontPx = ffmpegFontPx / (max(scaleX, scaleY) * SUBTITLE_PREVIEW_TO_BURN_FONT_FACTOR)
 */

export function previewSubtitleFontPxToFfmpegFontPx(
  previewFontPx: number,
  previewCanvasW: number,
  previewCanvasH: number,
  outputVideoW: number,
  outputVideoH: number,
): number {
  const cw = Math.max(1, previewCanvasW);
  const ch = Math.max(1, previewCanvasH);
  const ow = Math.max(1, outputVideoW);
  const oh = Math.max(1, outputVideoH);
  const scaleX = ow / cw;
  const scaleY = oh / ch;
  const m = Math.max(scaleX, scaleY);
  return Math.round(Math.max(10, previewFontPx * m * SUBTITLE_PREVIEW_TO_BURN_FONT_FACTOR));
}

export function ffmpegFontPxToPreviewSubtitleFontPx(
  ffmpegFontPx: number,
  previewCanvasW: number,
  previewCanvasH: number,
  outputVideoW: number,
  outputVideoH: number,
): number {
  const cw = Math.max(1, previewCanvasW);
  const ch = Math.max(1, previewCanvasH);
  const ow = Math.max(1, outputVideoW);
  const oh = Math.max(1, outputVideoH);
  const scaleX = ow / cw;
  const scaleY = oh / ch;
  const m = Math.max(scaleX, scaleY) * SUBTITLE_PREVIEW_TO_BURN_FONT_FACTOR;
  if (!(m > 0) || !Number.isFinite(ffmpegFontPx)) return ffmpegFontPx;
  return ffmpegFontPx / m;
}
