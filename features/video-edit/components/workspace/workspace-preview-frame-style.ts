import type { CSSProperties } from 'react';
import type { WorkspaceAspectId } from './workspace-top-bar';

/**
 * Sizes the framed preview so tall aspects (9:16) stay height-led.
 * `w-full` + `max-height` + `aspect-ratio` alone keeps 9:16 layouts incorrectly wide.
 */
export function getWorkspacePreviewFrameStyle(
  aspect: WorkspaceAspectId,
  options?: { maxHeight?: string },
): CSSProperties {
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
