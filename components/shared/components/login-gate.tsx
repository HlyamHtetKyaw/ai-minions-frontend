'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type Props = {
  message?: string;
};

export default function LoginGate({ message }: Props) {
  const t = useTranslations('shared.loginGate');

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border border-card-border bg-card p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Lock className="h-6 w-6 text-muted" />
      </div>
      <p className="max-w-xs text-sm text-muted">
        {message ?? t('defaultMessage')}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
      >
        {t('signIn')}
      </Link>
    </div>
  );
}
