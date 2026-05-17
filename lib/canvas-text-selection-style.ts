import type { CSSProperties } from 'react';

/** Thin CapCut-like selection chrome for text / SRT layers on the canvas. */
export const textLayerSelectionStyle = (selected: boolean): CSSProperties =>
  selected
    ? {
        border: 'none',
        outline: '1px dashed rgba(59, 130, 246, 0.92)',
        outlineOffset: 0,
        boxShadow: 'none',
      }
    : {
        border: '1px solid transparent',
        outline: 'none',
        boxShadow: 'none',
      };
