import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-6xl">🤷</span>
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-muted max-w-sm">{t('description')}</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover transition-colors"
      >
        {t('backToHome')}
      </Link>
    </div>
  );
}
