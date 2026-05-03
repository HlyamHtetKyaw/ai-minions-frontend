import { type SelectHTMLAttributes } from 'react';

type WorkspacePanelSelectProps = {
  label: string;
  id: string;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function WorkspacePanelSelect({ label, id, className = '', children, ...rest }: WorkspacePanelSelectProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={`w-full appearance-none rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-violet-500/45 focus:ring-1 focus:ring-violet-400/30 dark:border-white/10 dark:bg-black/50 ${className}`}
          {...rest}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
