import { type ReactNode } from 'react';

type DashboardStatGridProps = {
  children: ReactNode;
  className?: string;
};

/** Responsive row of stat cards (3 columns from `sm` up). */
export function DashboardStatGrid({ children, className = '' }: DashboardStatGridProps) {
  return <div className={`grid gap-4 sm:grid-cols-3 ${className}`}>{children}</div>;
}

type DashboardStatCardProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
};

/** Single metric: small label + large value. */
export function DashboardStatCard({ label, value, className = '' }: DashboardStatCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-black/20 p-5 dark:bg-white/4 ${className}`}
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
