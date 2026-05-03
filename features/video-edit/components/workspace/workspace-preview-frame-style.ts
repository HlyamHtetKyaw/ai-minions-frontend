import type { CSSProperties } from 'react';
import type { WorkspaceAspectId } from './workspace-top-bar';

export type WorkspacePreviewFrameFill = {
  widthPx: number;
  heightPx: number;
};

/** Margins inside the measured preview pane so the frame “floats” with air on sides, top, and bottom (Canva-style). */
const FILL_MARGIN_X_PX = 24;
const FILL_MARGIN_TOP_PX = 28;
const FILL_MARGIN_BOTTOM_PX = 40;

/**
 * Sizes the framed preview so tall aspects (9:16) stay height-led.
 * When {@link fillContainer} is set, the frame is the **largest** axis-aligned rect of the chosen aspect
 * that fits inside the pane **after** these margins (same idea as `object-fit: contain` at max scale).
 * When the timeline grows, the pane height shrinks and this rect shrinks with it (Canva-style).
 * Extra bottom margin keeps the video clear of the timeline strip visually.
 */
export function getWorkspacePreviewFrameStyle(
  aspect: WorkspaceAspectId,
  options?: { maxHeight?: string; fillContainer?: WorkspacePreviewFrameFill | null },
): CSSProperties {
  const fill = options?.fillContainer;
  if (fill && fill.widthPx > 0 && fill.heightPx > 0) {
    const W = Math.max(48, Math.floor(fill.widthPx) - FILL_MARGIN_X_PX * 2);
    const H = Math.max(48, Math.floor(fill.heightPx) - FILL_MARGIN_TOP_PX - FILL_MARGIN_BOTTOM_PX);
    if (aspect === '9:16') {
      // Portrait 9:16: width/height = 9/16 → height = width * 16/9; fit inside W×H.
      let w: number;
      let h: number;
      if (W * (16 / 9) <= H) {
        w = W;
        h = Math.floor(W * (16 / 9));
      } else {
        h = H;
        w = Math.floor(H * (9 / 16));
      }
      return {
        aspectRatio: '9 / 16',
        width: `${w}px`,
        height: `${h}px`,
        maxWidth: '100%',
        maxHeight: '100%',
      };
    }
    if (aspect === '1:1') {
      const side = Math.min(H, W);
      return {
        aspectRatio: '1',
        width: `${side}px`,
        height: `${side}px`,
        maxWidth: '100%',
        maxHeight: '100%',
      };
    }
    const maxWCap = aspect === '4:3' ? 960 : 1280;
    const Wc = Math.min(W, maxWCap);
    // Landscape: width/height = ratio (16/9 or 4/3) → height = width * (9/16) or width * (3/4).
    const ratio = aspect === '4:3' ? 4 / 3 : 16 / 9;
    const heightFromWidth = Wc / ratio;
    let w: number;
    let h: number;
    if (heightFromWidth <= H) {
      w = Wc;
      h = Math.floor(heightFromWidth);
    } else {
      h = H;
      w = Math.min(Wc, Math.floor(H * ratio));
    }
    return {
      aspectRatio: aspect === '4:3' ? '4 / 3' : '16 / 9',
      width: `${w}px`,
      height: `${h}px`,
      maxWidth: '100%',
      maxHeight: '100%',
    };
  }

  const maxH = options?.maxHeight ?? 'min(56dvh, 560px)';
  if (aspect === '9:16') {
    return {
      aspectRatio: '9 / 16',
      height: maxH,
      width: 'auto',
      maxWidth: 'min(92vw, 420px)',
    };
  }
  if (aspect === '1:1') {
    const side =
      options?.maxHeight != null
        ? `min(${options.maxHeight}, 92vw, 440px)`
        : 'min(min(56dvh, 560px), 92vw, 440px)';
    return {
      aspectRatio: '1',
      width: side,
      height: side,
    };
  }
  const wCap =
    aspect === '4:3'
      ? `min(100%, min(92vw, 960px), calc(${maxH} * 4 / 3))`
      : `min(100%, min(92vw, 1100px), calc(${maxH} * 16 / 9))`;
  return {
    aspectRatio: aspect === '4:3' ? '4 / 3' : '16 / 9',
    width: wCap,
    maxWidth: '100%',
    height: 'auto',
    maxHeight: maxH,
  };
}
