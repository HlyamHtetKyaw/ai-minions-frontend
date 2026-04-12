import { type ReactNode } from 'react';

type DashboardSectionHeaderProps = {
  title: ReactNode;
  /** Filters, sort, or actions aligned to the end on larger screens. */
  trailing?: ReactNode;
  className?: string;
};

/** Section title row with optional trailing controls. */
export function DashboardSectionHeader({
  title,
  trailing,
  className = '',
}: DashboardSectionHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {trailing}
    </div>
  );
}
