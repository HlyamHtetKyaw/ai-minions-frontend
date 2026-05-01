import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import HeroOverview from '@/features/home/components/hero-overview';
import FeatureGrid from '@/features/home/components/feature-grid';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: t('toolsPage.metaTitle'),
    description: t('toolsPage.metaDescription'),
  };
}

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 pb-20 pt-6">
      <HeroOverview />
      <FeatureGrid />
    </div>
  );
}
