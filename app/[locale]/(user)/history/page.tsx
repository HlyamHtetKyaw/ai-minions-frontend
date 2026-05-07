import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AccountUsageHistoryClient from '@/features/account/account-usage-history-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return {
    title: t('usageHistory.title'),
    description: t('usageHistory.subtitle'),
  };
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountUsageHistoryClient />;
}

