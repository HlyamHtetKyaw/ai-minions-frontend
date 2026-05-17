import type { HandleStyles } from 're-resizable';

const handleVisual = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 1,
  zIndex: 2,
} as const;

/**
 * Blur overlay resize grips — wide enough for touch.
 * (8×8 overrides break re-resizable’s default full-edge hit targets.)
 */
export const blurResizeHandleStyles: HandleStyles = {
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

export const blurResizeEnabled = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  topLeft: true,
  bottomRight: true,
  bottomLeft: true,
} as const;
