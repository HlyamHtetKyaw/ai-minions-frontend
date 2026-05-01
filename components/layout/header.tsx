'use client';

import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import HeaderShell from '@/components/layout/header-shell';

export default function Header() {
  const pathname = usePathname();
  const t = useTranslations('header');

  if (pathname === '/video-edit/work-space') {
    return null;
  }

  return (
    <header className="sticky top-0 z-100 min-w-0 bg-background dark:bg-transparent">
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
