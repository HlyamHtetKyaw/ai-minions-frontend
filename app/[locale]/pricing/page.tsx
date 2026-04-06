import { getPublicPricing } from '@/lib/pricing';
import { PricingClient } from '@/features/pricing/components/pricing-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await getPublicPricing();
  return <PricingClient data={data} />;
}
