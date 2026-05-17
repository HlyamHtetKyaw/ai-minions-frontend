'use client';

import {
  DEFAULT_CAPTION_BACKGROUND_COLOR,
  resolveCaptionBackgroundColor,
} from '@/lib/text-layer-caption-style';

const SWATCHES = ['#ffffff', '#000000', '#7F77DD', '#5DCAA5', '#EF9F27'] as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type SubtitleStyleControlsProps = {
  primaryColor: string;
  textOpacity: number;
  backgroundColor: string;
  backgroundOpacity: number;
  disabled?: boolean;
  onPrimaryColorChange: (color: string) => void;
  onTextOpacityChange: (opacity: number) => void;
  onBackgroundColorChange: (color: string) => void;
  onBackgroundOpacityChange: (opacity: number) => void;
  labels: {
    textColor: string;
    textOpacity: string;
    captionBackground: string;
    captionBackgroundHint: string;
    backgroundColor: string;
    backgroundOpacity: string;
  };
};

export function SubtitleStyleControls({
  primaryColor,
  textOpacity,
  backgroundColor,
  backgroundOpacity,
  disabled = false,
  onPrimaryColorChange,
  onTextOpacityChange,
  onBackgroundColorChange,
  onBackgroundOpacityChange,
  labels,
}: SubtitleStyleControlsProps) {
  const bgHex = resolveCaptionBackgroundColor({ backgroundColor });

  return (
    <div className="grid gap-3 border-t border-card-border/60 pt-2 sm:grid-cols-2">
      <section className="space-y-1.5 sm:col-span-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {labels.textColor}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              aria-label={`Color ${c}`}
              onClick={() => onPrimaryColorChange(c)}
              className="h-6 w-6 shrink-0 rounded border border-violet-200/60 disabled:opacity-50 dark:border-violet-400/25"
              style={{
                backgroundColor: c,
                boxShadow:
                  primaryColor.toLowerCase() === c.toLowerCase()
                    ? '0 0 0 2px #7c5cff'
                    : undefined,
              }}
            />
          ))}
          <label className="ml-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Custom</span>
            <input
              type="color"
              disabled={disabled}
              value={/^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : '#ffffff'}
              onChange={(e) => onPrimaryColorChange(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-violet-200/50 bg-transparent p-0 dark:border-violet-400/20"
            />
          </label>
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {labels.textOpacity}
        </p>
        <label className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            disabled={disabled}
            value={textOpacity}
            onChange={(e) => onTextOpacityChange(clamp(Number(e.target.value), 0, 100))}
            className="h-2 min-w-0 flex-1 accent-[#7c5cff]"
          />
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-foreground/80">
            {textOpacity}
          </span>
        </label>
      </section>

      <section className="space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {labels.captionBackground}
        </p>
        <p className="text-[9px] leading-snug text-muted-foreground/90">{labels.captionBackgroundHint}</p>
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-10 shrink-0">{labels.backgroundColor}</span>
          <input
            type="color"
            disabled={disabled}
            value={/^#[0-9A-Fa-f]{6}$/.test(bgHex) ? bgHex : DEFAULT_CAPTION_BACKGROUND_COLOR}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-violet-200/50 bg-transparent p-0 dark:border-violet-400/20"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[10px] text-foreground/80">{labels.backgroundOpacity}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={backgroundOpacity}
            onChange={(e) =>
              onBackgroundOpacityChange(clamp(Number(e.target.value) || 0, 0, 100))
            }
            className="h-2 min-w-0 flex-1 accent-[#7c5cff]"
          />
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-foreground/80">
            {backgroundOpacity}
          </span>
        </label>
      </section>
    </div>
  );
}
