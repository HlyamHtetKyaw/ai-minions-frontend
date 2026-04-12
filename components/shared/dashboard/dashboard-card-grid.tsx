import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

type DashboardCardGridProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Responsive card grid: 1 col → 2 from `sm` → 3 from `lg`.
 * Use with `DashboardCardGridItem` for each cell.
 */
export function DashboardCardGrid({ children, className = '' }: DashboardCardGridProps) {
  return (
    <ul className={`grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {children}
    </ul>
  );
}

type DashboardCardGridItemProps = ComponentPropsWithoutRef<'li'>;

export function DashboardCardGridItem({ className = '', children, ...rest }: DashboardCardGridItemProps) {
  return (
    <li className={className} {...rest}>
      {children}
    </li>
  );
}

type DashboardMediaCardShellProps = {
  children: ReactNode;
  className?: string;
};

/** Bordered card shell for media thumbnails + footer (projects, assets, etc.). */
export function DashboardMediaCardShell({ children, className = '' }: DashboardMediaCardShellProps) {
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/15 shadow-sm dark:bg-white/3 ${className}`}
    >
      {children}
    </article>
  );
}
