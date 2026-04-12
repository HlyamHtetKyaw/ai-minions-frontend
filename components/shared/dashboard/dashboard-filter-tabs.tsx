'use client';

import { type ReactNode } from 'react';

export type DashboardFilterOption<T extends string> = {
  id: T;
  label: ReactNode;
};

type DashboardFilterTabsProps<T extends string> = {
  options: DashboardFilterOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
};

/** Pill-style filter tabs (single selection). */
export function DashboardFilterTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: DashboardFilterTabsProps<T>) {
  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? 'border border-foreground/40 bg-foreground/5 text-foreground'
                : 'border border-transparent text-muted hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
