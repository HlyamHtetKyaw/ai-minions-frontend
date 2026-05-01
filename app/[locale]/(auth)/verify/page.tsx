import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import VerifyClient from './verify-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'verify' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

function VerifyFallback() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center py-16">
      <div className="h-40 w-full max-w-md animate-pulse rounded-2xl border border-card-border bg-card/40" />
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyClient />
    </Suspense>
  );
}
