'use client';

import { Loader2 } from 'lucide-react';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

interface ActionButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'type'> {
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  /** Shown to the left of the label when not loading */
  icon?: ReactNode;
}

export default function ActionButton({
  label,
  loadingLabel,
  isLoading,
  icon,
  disabled,
  className = 'flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer',
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={className}
      {...props}
      disabled={Boolean(disabled) || isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        icon
      )}
      {isLoading ? loadingLabel : label}
    </button>
  );
}
