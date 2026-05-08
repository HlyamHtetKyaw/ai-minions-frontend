'use client';

import { useEffect, useRef } from 'react';

export type EstimatedCostProps = {
  points: number;
  isLoading?: boolean;
  variant?: 'card' | 'inline' | 'badge';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function getTone(points: number) {
  if (points < 100) return 'text-emerald-700 dark:text-emerald-300';
  if (points <= 300) return 'text-amber-700 dark:text-amber-300';
  return 'text-rose-700 dark:text-rose-300';
}

export default function EstimatedCost({
  points,
  isLoading = false,
  variant = 'card',
  size = 'md',
  showLabel = true,
  animated = true,
  className,
}: EstimatedCostProps) {
  const prevPointsRef = useRef(points);
  const valueRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!animated) return;
    if (prevPointsRef.current === points) return;
    prevPointsRef.current = points;

    const node = valueRef.current;
    if (!node) return;

    const animation = node.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.05)' },
        { transform: 'scale(1)' },
      ],
      { duration: 220, easing: 'ease-out' },
    );

    return () => animation.cancel();
  }, [animated, points]);

  const safePoints = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
  const labelSize =
    size === 'lg' ? 'text-sm' : size === 'sm' ? 'text-[10px]' : 'text-xs';
  const valueSize =
    variant === 'badge'
      ? size === 'lg'
        ? 'text-base'
        : size === 'sm'
          ? 'text-xs'
          : 'text-sm'
      : size === 'lg'
        ? 'text-3xl'
        : size === 'sm'
          ? 'text-lg'
          : 'text-2xl';

  const shell = cx(
    variant === 'card' &&
      'rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-100/80 to-indigo-100/80 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:from-purple-600/20 dark:to-indigo-600/20',
    variant === 'inline' &&
      'flex items-center gap-2 rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-100/70 to-indigo-100/70 px-3 py-2 dark:border-white/10 dark:from-purple-600/10 dark:to-indigo-600/10',
    variant === 'badge' &&
      'inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-gradient-to-r from-violet-100/80 to-indigo-100/80 px-3 py-1.5 dark:border-white/10 dark:from-purple-600/20 dark:to-indigo-600/20',
    className,
  );

  return (
    <div className={shell} title="Cost is calculated based on input length and complexity">
      <div className={cx('flex items-center', variant === 'card' ? 'justify-between gap-4' : 'gap-2')}>
        <div className="flex min-w-0 items-center gap-2">
          {showLabel ? (
            <span className={cx('font-medium text-slate-600 dark:text-white/60', labelSize)}>Estimated Cost</span>
          ) : null}
        </div>

        {isLoading ? (
          <span
            className={cx(
              'inline-block h-7 w-24 animate-pulse rounded-md bg-violet-300/35 dark:bg-white/15',
              variant === 'badge' && 'h-5 w-14 rounded-full',
              size === 'lg' && variant !== 'badge' && 'h-9 w-28',
            )}
          />
        ) : (
          <span
            ref={valueRef}
            className={cx(
              'font-bold tabular-nums text-slate-900 transition-transform duration-200 dark:text-white',
              valueSize,
              getTone(safePoints),
            )}
          >
            {safePoints.toLocaleString()} Points
          </span>
        )}
      </div>
    </div>
  );
}
