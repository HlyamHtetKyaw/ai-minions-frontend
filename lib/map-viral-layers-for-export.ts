import type { BlurLayer, TextLayer } from '@/store/editorStore';

export function mapTextLayersForWorkspaceExport(layers: TextLayer[]) {
  return layers.map((l) => ({
    id: l.id,
    content: l.content,
    x: l.x,
    y: l.y,
    width: l.width,
    height: l.height,
    fontSize: l.fontSize,
    fontFamily: l.fontFamily,
    color: l.color,
    opacity: l.opacity,
    startTime: l.startTime,
    endTime: l.endTime,
  }));
}

export function mapBlurLayersForWorkspaceExport(layers: BlurLayer[]) {
  return layers.map((l) => ({
    id: l.id,
    x: l.x,
    y: l.y,
    width: l.width,
    height: l.height,
    intensity: l.intensity,
    startTime: l.startTime,
    endTime: l.endTime,
  }));
}

export function viralDisplayToNaturalScale(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number } {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const scaleX = naturalW > 0 ? naturalW / fw : 1;
  const scaleY = naturalH > 0 ? naturalH / fh : 1;
  return { x: scaleX, y: scaleY };
}
