import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import LocaleSwitcher from './LocaleSwitcher';
import HeaderClient from './HeaderClient';
import { getTranslations } from 'next-intl/server';

export default async function Header() {
  const tHeader = await getTranslations('header');

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-full glass-panel px-3 py-2 pl-4 shadow-lg sm:px-5 sm:py-2.5">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-[#0f172a] shadow-md"
            style={{
              background: 'linear-gradient(145deg, var(--accent-gold) 0%, #b8860b 100%)',
            }}
          >
            AI
          </span>
          <div className="hidden min-w-0 sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {tHeader('dashboardLabel')}
            </p>
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {tHeader('brandTitle')}
            </p>
          </div>
        </Link>

        <HeaderClient toolsLabel={tHeader('aiModels')} homeLabel={tHeader('home')} />

        {/* Right side */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <LocaleSwitcher label={tHeader('languageLabel')} />
          </div>

          <ThemeToggle />

          <span
            className="hidden rounded-full border border-accent-gold/40 bg-accent-gold-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold lg:inline-flex"
            title={tHeader('pointsHint')}
          >
            {tHeader('pointsBadge')}
          </span>

          <button
            type="button"
            className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            {tHeader('logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
