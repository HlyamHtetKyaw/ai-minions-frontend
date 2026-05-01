'use client';

import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import HeaderShell from '@/components/layout/header-shell';

const SCROLL_THRESHOLD_PX = 12;

export default function Header() {
  const pathname = usePathname();
  const t = useTranslations('header');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname === '/video-edit/work-space') {
    return null;
  }

  const headerSurface = scrolled
    ? 'border-border/50 bg-background/92 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-elevated/92'
    : 'border-transparent bg-background dark:bg-transparent';

  return (
    <header
      className={`sticky top-0 z-100 min-w-0 w-full border-b transition-[background-color,backdrop-filter,box-shadow,border-color] duration-300 ${headerSurface}`}
    >
      <HeaderShell
        dashboardLabel={t('dashboardLabel')}
        brandTitle={t('brandTitle')}
        languageLabel={t('languageLabel')}
        homeLabel={t('home')}
        workspaceLabel={t('tools')}
        pricingLabel={t('pricing')}
      />
    </header>
  );
}
