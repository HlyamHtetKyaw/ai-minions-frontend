export const TEXT_LAYER_FONT_SIZE_MIN = 8;
export const TEXT_LAYER_FONT_SIZE_MAX = 200;

/** Isotropic scale when the text box is resized (matches canvas frame resize in editorStore). */
export function textLayerResizeFontScale(
  prevWidth: number,
  prevHeight: number,
  nextWidth: number,
  nextHeight: number,
): number {
  if (prevWidth <= 0 || prevHeight <= 0 || nextWidth <= 0 || nextHeight <= 0) {
    return 1;
  }
  return Math.sqrt((nextWidth / prevWidth) * (nextHeight / prevHeight));
}

export function scaleTextLayerFontSize(
  fontSize: number,
  prevWidth: number,
  prevHeight: number,
  nextWidth: number,
  nextHeight: number,
): number {
  const scale = textLayerResizeFontScale(prevWidth, prevHeight, nextWidth, nextHeight);
  return Math.min(
    TEXT_LAYER_FONT_SIZE_MAX,
    Math.max(TEXT_LAYER_FONT_SIZE_MIN, Math.round(fontSize * scale)),
  );
}
