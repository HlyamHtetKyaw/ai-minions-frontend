import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type WorkspaceIconButtonProps = {
  children: ReactNode;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function WorkspaceIconButton({
  children,
  label,
  className = '',
  type = 'button',
  ...rest
}: WorkspaceIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 shadow-none transition-colors hover:border-violet-300 hover:bg-violet-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 dark:border-white/10 dark:bg-black/40 dark:text-foreground dark:hover:border-white/25 dark:hover:bg-white/5 dark:focus-visible:ring-offset-zinc-950 [&>svg]:h-4 [&>svg]:w-4 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
