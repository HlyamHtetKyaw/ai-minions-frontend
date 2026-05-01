'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import logoSrc from '@/assets/logo.png';

export default function Footer() {
  const pathname = usePathname();
  const t = useTranslations('header');
  const year = new Date().getFullYear();

  if (pathname === '/video-edit/work-space') {
    return null;
  }

  return (
    <footer className="mt-12 border-t border-glass-border/70 footer-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src={logoSrc}
            alt={t('brandTitle')}
            width={108}
            height={46}
            className="h-10 w-auto object-contain"
          />
          <p className="text-sm text-muted">
            {t('brandTitle')} · {year}
          </p>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="footer-link">
            {t('home')}
          </Link>
          <Link href="/tools" className="footer-link">
            {t('tools')}
          </Link>
          <Link href="/pricing" className="footer-link">
            {t('pricing')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

