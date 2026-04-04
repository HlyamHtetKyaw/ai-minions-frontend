export type FilterPreset = 'none' | 'bw' | 'warm' | 'cool' | 'vivid';
export type TextPosition = 'top' | 'center' | 'bottom';

export const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];

export type ExportFormat = 'mp4' | 'webm' | 'mov';
export type ExportQuality = '1080p' | '720p' | '480p';

export type ToolbarValues = {
  trimStart: string;
  trimEnd: string;
  filter: FilterPreset;
  brightness: number;
  contrast: number;
  saturation: number;
  speed: PlaybackSpeed;
  overlayText: string;
  textPosition: TextPosition;
};

export const TOOLBAR_DEFAULTS: ToolbarValues = {
  trimStart: '',
  trimEnd: '',
  filter: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  speed: 1,
  overlayText: '',
  textPosition: 'bottom',
};

export const FILTER_PRESETS: Record<FilterPreset, string> = {
  none: '',
  bw: 'grayscale(1)',
  warm: 'sepia(0.4) saturate(1.3)',
  cool: 'hue-rotate(200deg) saturate(0.8)',
  vivid: 'saturate(2) contrast(1.1)',
};
