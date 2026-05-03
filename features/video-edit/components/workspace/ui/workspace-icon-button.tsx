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
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-foreground transition-colors hover:border-zinc-400 hover:bg-zinc-100 [&>svg]:h-4 [&>svg]:w-4 dark:border-white/10 dark:bg-black/40 dark:hover:border-white/25 dark:hover:bg-white/5 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
