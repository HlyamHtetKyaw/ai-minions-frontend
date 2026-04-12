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
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/40 text-foreground transition-colors hover:border-white/25 hover:bg-white/5 [&>svg]:h-4 [&>svg]:w-4 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
