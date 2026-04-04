'use client';

import { useTheme } from './ThemeProvider';
import { useTranslations } from 'next-intl';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const t = useTranslations('themeToggle');

  return (
    <button
      onClick={toggle}
      aria-label={t('toggleTheme')}
      className="rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
    >
      {theme === 'dark' ? (
        <Sun className="h-[18px] w-[18px]" />
      ) : (
        <Moon className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
