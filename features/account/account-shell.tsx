'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export function AccountShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('account');
  const pathname = usePathname();
  const isPassword = pathname === '/account/password';

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:pt-12">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {t('kicker')}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {t('subtitle')}
      </p>

      <nav
        className="mt-8 flex gap-6 border-b border-card-border"
        aria-label={t('navLabel')}
      >
        <Link
          href="/account"
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            !isPassword
              ? 'border-accent-gold text-foreground'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          {t('tabProfile')}
        </Link>
        <Link
          href="/account/password"
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            isPassword
              ? 'border-accent-gold text-foreground'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          {t('tabPassword')}
        </Link>
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
