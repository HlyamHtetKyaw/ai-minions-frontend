import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AccountProfileClient from '@/features/account/account-profile-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return {
    title: t('metaTitleProfile'),
    description: t('metaDescriptionProfile'),
  };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountProfileClient />;
}
