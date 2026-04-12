import { type ReactNode } from 'react';

type DashboardLoadMoreRowProps = {
  children: ReactNode;
  className?: string;
};

/** Centers a load-more control or pagination affordance. */
export function DashboardLoadMoreRow({ children, className = '' }: DashboardLoadMoreRowProps) {
  return <div className={`flex justify-center pb-4 pt-2 ${className}`}>{children}</div>;
}
