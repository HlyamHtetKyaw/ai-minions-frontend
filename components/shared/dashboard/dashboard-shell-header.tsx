import { type ReactNode } from 'react';

type DashboardShellHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Top row: page title + optional subtitle, optional trailing action (e.g. primary link). */
export function DashboardShellHeader({
  title,
  subtitle,
  action,
  className = '',
}: DashboardShellHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle != null ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
