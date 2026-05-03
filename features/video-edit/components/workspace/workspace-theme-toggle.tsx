'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';

type WorkspaceThemeToggleProps = {
  className?: string;
};

/** Toggles global app theme (`ThemeProvider`): light UI vs dark UI for the workspace chrome. */
export function WorkspaceThemeToggle({ className = '' }: WorkspaceThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 dark:border-white/15 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800/90 ${className}`}
    >
      {dark ? <Sun className="h-4 w-4" strokeWidth={1.85} aria-hidden /> : null}
      {!dark ? <Moon className="h-4 w-4" strokeWidth={1.85} aria-hidden /> : null}
    </button>
  );
}
