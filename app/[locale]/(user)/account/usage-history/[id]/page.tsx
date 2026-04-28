import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AccountUsageHistoryDetailClient from '@/features/account/account-usage-history-detail-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return {
    title: t('usageHistory.detail.metaTitle'),
    description: t('usageHistory.detail.metaDescription'),
  };
}

export default async function AccountUsageHistoryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AccountUsageHistoryDetailClient id={id} />;
}
