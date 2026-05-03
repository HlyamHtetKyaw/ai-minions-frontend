import { type InputHTMLAttributes } from 'react';

type WorkspacePanelNumberFieldProps = {
  label: string;
  id: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function WorkspacePanelNumberField({
  label,
  id,
  className = '',
  ...rest
}: WorkspacePanelNumberFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={`w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-foreground outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-400/25 dark:border-white/10 dark:bg-black/40 ${className}`}
        {...rest}
      />
    </div>
  );
}
