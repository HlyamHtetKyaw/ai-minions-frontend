'use client';

import { useEffect, useRef, useState } from 'react';

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
  if (points < 100) return 'text-emerald-300';
  if (points <= 300) return 'text-amber-300';
  return 'text-rose-300';
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
  const [animateTick, setAnimateTick] = useState(false);
  const prevPointsRef = useRef(points);

  useEffect(() => {
    if (!animated) return;
    if (prevPointsRef.current === points) return;
    prevPointsRef.current = points;
    setAnimateTick(true);
    const id = setTimeout(() => setAnimateTick(false), 220);
    return () => clearTimeout(id);
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
      'rounded-2xl border border-white/10 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 px-4 py-3 backdrop-blur-sm',
    variant === 'inline' &&
      'flex items-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 px-3 py-2',
    variant === 'badge' &&
      'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 px-3 py-1.5',
    className,
  );

  return (
    <div className={shell} title="Cost is calculated based on input length and complexity">
      <div className={cx('flex items-center', variant === 'card' ? 'justify-between gap-4' : 'gap-2')}>
        <div className="flex min-w-0 items-center gap-2">
          {showLabel ? (
            <span className={cx('font-medium text-white/60', labelSize)}>Estimated Cost</span>
          ) : null}
        </div>

        {isLoading ? (
          <span
            className={cx(
              'inline-block h-7 w-24 animate-pulse rounded-md bg-white/15',
              variant === 'badge' && 'h-5 w-14 rounded-full',
              size === 'lg' && variant !== 'badge' && 'h-9 w-28',
            )}
          />
        ) : (
          <span
            className={cx(
              'font-bold tabular-nums text-white transition-transform duration-200',
              valueSize,
              getTone(safePoints),
              animated && animateTick && 'scale-105',
            )}
          >
            {safePoints.toLocaleString()} Points
          </span>
        )}
      </div>
    </div>
  );
}
