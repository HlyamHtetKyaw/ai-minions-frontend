import { type InputHTMLAttributes } from 'react';

type WorkspacePanelSliderProps = {
  label: string;
  valueLabel: string;
  id: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function WorkspacePanelSlider({
  label,
  valueLabel,
  id,
  className = '',
  ...rest
}: WorkspacePanelSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className="font-mono text-xs text-muted">{valueLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-400 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-300 [&::-webkit-slider-thumb]:bg-zinc-900 ${className}`}
        {...rest}
      />
    </div>
  );
}
