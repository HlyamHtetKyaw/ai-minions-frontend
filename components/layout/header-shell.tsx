'use client';

import { Link } from '@/i18n/navigation';
import ThemeToggle from '@/components/theme/theme-toggle';
import LocaleSwitcher from '@/components/layout/locale-switcher';
import HeaderSession from '@/components/layout/header-session';
import { AuthSessionProvider } from '@/components/layout/auth-session-context';
import { HeaderDesktopNav, HeaderMobileNav, type HeaderNavLabels } from '@/components/layout/header-client';

type Props = HeaderNavLabels & {
  dashboardLabel: string;
  brandTitle: string;
  languageLabel: string;
};

export default function HeaderShell({
  dashboardLabel,
  brandTitle,
  languageLabel,
  homeLabel,
  workspaceLabel,
  pricingLabel,
}: Props) {
  const navLabels: HeaderNavLabels = {
    homeLabel,
    workspaceLabel,
    pricingLabel,
  };

  return (
    <AuthSessionProvider>
      <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center gap-2 rounded-full glass-panel px-2 py-2 pl-3 shadow-lg sm:gap-3 sm:px-4 sm:py-2.5 sm:pl-4 md:px-5">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{dashboardLabel}</p>
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{brandTitle}</p>
          </div>
        </Link>

        <HeaderDesktopNav {...navLabels} />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
          <div className="hidden sm:block">
            <LocaleSwitcher label={languageLabel} />
          </div>

          <ThemeToggle />

          <HeaderSession />

          <HeaderMobileNav {...navLabels} />
        </div>
      </div>
    </AuthSessionProvider>
  );
}
