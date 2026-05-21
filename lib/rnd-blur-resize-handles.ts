import type { CSSProperties } from 'react';

/** Same shape as `re-resizable` HandleStyles (`react-rnd` resizeHandleStyles). */
type HandleStyles = {
  top?: CSSProperties;
  right?: CSSProperties;
  bottom?: CSSProperties;
  left?: CSSProperties;
  topRight?: CSSProperties;
  bottomRight?: CSSProperties;
  bottomLeft?: CSSProperties;
  topLeft?: CSSProperties;
};

type ResizeHandleStyle = CSSProperties;

const handleVisual = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
  zIndex: 2,
} as const;

/**
 * Canvas overlay resize grips (8 directions) — wide enough for touch.
 * Small square-only overrides break re-resizable’s default full-edge hit targets.
 */
export const overlayResizeHandleStyles: HandleStyles = {
  top: {
    ...handleVisual,
    width: '100%',
    height: 14,
    top: -7,
    left: 0,
    cursor: 'ns-resize',
  },
  right: {
    ...handleVisual,
    width: 14,
    height: '100%',
    right: -7,
    top: 0,
    left: undefined,
    cursor: 'ew-resize',
  },
  bottom: {
    ...handleVisual,
    width: '100%',
    height: 14,
    bottom: -7,
    top: undefined,
    left: 0,
    cursor: 'ns-resize',
  },
  left: {
    ...handleVisual,
    width: 14,
    height: '100%',
    left: -7,
    top: 0,
    cursor: 'ew-resize',
  },
  topRight: {
    ...handleVisual,
    width: 24,
    height: 24,
    top: -12,
    right: -12,
    cursor: 'nesw-resize',
  },
  topLeft: {
    ...handleVisual,
    width: 24,
    height: 24,
    top: -12,
    left: -12,
    cursor: 'nwse-resize',
  },
  bottomRight: {
    ...handleVisual,
    width: 24,
    height: 24,
    bottom: -12,
    right: -12,
    cursor: 'nesw-resize',
  },
  bottomLeft: {
    ...handleVisual,
    width: 24,
    height: 24,
    bottom: -12,
    left: -12,
    cursor: 'nwse-resize',
  },
};

/** Invisible edge hit targets (resize works; no thick white bars). */
const textEdgeHandle = (cursor: string): ResizeHandleStyle => ({
  background: 'transparent',
  border: 'none',
  boxShadow: 'none',
  zIndex: 2,
  cursor,
});

const textCornerHandle = (cursor: string, position: Record<string, number | string>): ResizeHandleStyle => ({
  background: '#ffffff',
  border: '1px solid rgba(59, 130, 246, 0.85)',
  borderRadius: 1,
  width: 5,
  height: 5,
  zIndex: 3,
  boxShadow: 'none',
  cursor,
  ...position,
});

/** CapCut-thin: dashed frame + tiny corner dots; edges resize with invisible strips. */
export const textOverlayResizeHandleStyles: HandleStyles = {
  top: {
    ...textEdgeHandle('ns-resize'),
    width: '100%',
    height: 10,
    top: -5,
    left: 0,
  },
  right: {
    ...textEdgeHandle('ew-resize'),
    width: 10,
    height: '100%',
    right: -5,
    top: 0,
    left: undefined,
  },
  bottom: {
    ...textEdgeHandle('ns-resize'),
    width: '100%',
    height: 10,
    bottom: -5,
    top: undefined,
    left: 0,
  },
  left: {
    ...textEdgeHandle('ew-resize'),
    width: 10,
    height: '100%',
    left: -5,
    top: 0,
  },
  topRight: textCornerHandle('nesw-resize', { top: -2, right: -2 }),
  topLeft: textCornerHandle('nwse-resize', { top: -2, left: -2 }),
  bottomRight: textCornerHandle('nesw-resize', { bottom: -2, right: -2 }),
  bottomLeft: textCornerHandle('nwse-resize', { bottom: -2, left: -2 }),
};

/** Wider hit targets for touch; keeps thin corner dots + invisible edge strips. */
export const textOverlayTouchResizeHandleStyles: HandleStyles = {
  top: {
    ...textEdgeHandle('ns-resize'),
    width: '100%',
    height: 20,
    top: -10,
    left: 0,
  },
  right: {
    ...textEdgeHandle('ew-resize'),
    width: 20,
    height: '100%',
    right: -10,
    top: 0,
    left: undefined,
  },
  bottom: {
    ...textEdgeHandle('ns-resize'),
    width: '100%',
    height: 20,
    bottom: -10,
    top: undefined,
    left: 0,
  },
  left: {
    ...textEdgeHandle('ew-resize'),
    width: 20,
    height: '100%',
    left: -10,
    top: 0,
  },
  topRight: textCornerHandle('nesw-resize', { top: -12, right: -12, width: 24, height: 24 }),
  topLeft: textCornerHandle('nwse-resize', { top: -12, left: -12, width: 24, height: 24 }),
  bottomRight: textCornerHandle('nesw-resize', { bottom: -12, right: -12, width: 24, height: 24 }),
  bottomLeft: textCornerHandle('nwse-resize', { bottom: -12, left: -12, width: 24, height: 24 }),
};

export const overlayResizeEnabled = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  topLeft: true,
  bottomRight: true,
  bottomLeft: true,
} as const;

export const blurResizeHandleStyles = overlayResizeHandleStyles;
export const blurResizeEnabled = overlayResizeEnabled;
