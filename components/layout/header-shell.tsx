'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import ThemeToggle from '@/components/theme/theme-toggle';
import LocaleSwitcher from '@/components/layout/locale-switcher';
import HeaderSession from '@/components/layout/header-session';
import { AuthSessionProvider } from '@/components/layout/auth-session-context';
import { HeaderDesktopNav, HeaderMobileNav, type HeaderNavLabels } from '@/components/layout/header-client';
import logoSrc from '@/assets/logo.png';

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
      <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center gap-4 rounded-full glass-panel shadow-lg sm:gap-5 dark:border-transparent! dark:bg-transparent! dark:shadow-none">
        <Link href="/" className="flex shrink-0 items-center gap-5 pr-6">
          <div className="flex items-center justify-center rounded-3xl">
            <Image
              src={logoSrc}
              alt={brandTitle}
              width={320}
              height={137}
              className="h-[64px] w-auto sm:h-[72px] md:h-[80px] lg:h-[88px] object-contain object-left shrink-0"
              sizes="(max-width: 380px) 140px, (max-width: 640px) 180px, (max-width: 768px) 200px, (max-width: 1024px) 220px, 260px"
              priority
            />
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">{dashboardLabel}</p>

            <p className="truncate text-xl font-bold leading-tight text-foreground">{brandTitle}</p>
          </div>

          <div className="hidden lg:block h-12 w-px shrink-0 bg-border/60 ml-2" aria-hidden />
        </Link>

        <div className="flex min-w-0 flex-1 justify-center">
          <HeaderDesktopNav {...navLabels} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
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
