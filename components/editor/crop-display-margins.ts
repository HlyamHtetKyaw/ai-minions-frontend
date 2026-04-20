import type { CropPixelRect, CropSettings } from '@/store/editorStore';

function objectContainMetrics(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
) {
  if (naturalW <= 0 || naturalH <= 0) {
    return {
      scale: 1,
      offX: 0,
      offY: 0,
    };
  }
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const offX = (containerW - naturalW * scale) / 2;
  const offY = (containerH - naturalH * scale) / 2;
  return { scale, offX, offY };
}

/** Display-space margins from natural crop rect (rotation / flip must be handled elsewhere). */
export function marginsFromNaturalCropRect(
  cropped: CropPixelRect,
  canvasW: number,
  canvasH: number,
  naturalW: number,
  naturalH: number,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
) {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot !== 0 || flipH || flipV) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const { scale, offX, offY } = objectContainMetrics(
    canvasW,
    canvasH,
    naturalW,
    naturalH,
  );
  const dx = cropped.x * scale + offX;
  const dy = cropped.y * scale + offY;
  const dw = cropped.width * scale;
  const dh = cropped.height * scale;
  return {
    left: Math.max(0, dx),
    top: Math.max(0, dy),
    right: Math.max(0, canvasW - dx - dw),
    bottom: Math.max(0, canvasH - dy - dh),
  };
}

/**
 * Pixels to use for clip-path on the video box (same coordinates as crop overlay).
 * Fills in from `croppedAreaPixels` when stored edges are zero.
 */
export function resolveAppliedCropDisplayMargins(
  crop: CropSettings,
  canvasW: number,
  canvasH: number,
  naturalW: number,
  naturalH: number,
): { top: number; right: number; bottom: number; left: number } {
  let { top, bottom, left, right } = crop;
  const sum = top + bottom + left + right;
  if (
    sum <= 0 &&
    crop.croppedAreaPixels &&
    naturalW > 0 &&
    naturalH > 0 &&
    canvasW > 0 &&
    canvasH > 0
  ) {
    const m = marginsFromNaturalCropRect(
      crop.croppedAreaPixels,
      canvasW,
      canvasH,
      naturalW,
      naturalH,
      crop.easyRotation,
      crop.flipHorizontal,
      crop.flipVertical,
    );
    top = m.top;
    bottom = m.bottom;
    left = m.left;
    right = m.right;
  }
  return { top, right, bottom, left };
}
