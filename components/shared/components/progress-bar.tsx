'use client';

type ProgressBarProps = {
  value?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
  isComplete?: boolean;
  className?: string;
  fillClassName?: string;
  completeFillClassName?: string;
  indeterminate?: boolean;
  indeterminateFillClassName?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ProgressBar({
  value = 0,
  min = 0,
  max = 100,
  ariaLabel,
  isComplete = false,
  className = '',
  fillClassName = 'bg-foreground',
  completeFillClassName = 'bg-emerald-600',
  indeterminate = false,
  indeterminateFillClassName = 'w-[40%] max-w-[12rem] animate-pulse bg-violet-500',
}: ProgressBarProps) {
  const normalizedMax = Number.isFinite(max) ? max : 100;
  const normalizedMin = Number.isFinite(min) ? min : 0;
  const clamped = clamp(Number.isFinite(value) ? value : normalizedMin, normalizedMin, normalizedMax);
  const percent =
    normalizedMax === normalizedMin ? 0 : ((clamped - normalizedMin) / (normalizedMax - normalizedMin)) * 100;

  return (
    <div
      className={`mt-2 h-2.5 w-full overflow-hidden rounded-full bg-subtle ${className}`.trim()}
      role="progressbar"
      aria-valuemin={normalizedMin}
      aria-valuemax={normalizedMax}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-label={ariaLabel}
    >
      {indeterminate ? (
        <div className={`h-2.5 rounded-full ${indeterminateFillClassName}`.trim()} />
      ) : (
        <div
          className={`h-2.5 rounded-full transition-[width] duration-300 ease-out ${
            isComplete ? completeFillClassName : fillClassName
          }`.trim()}
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}
