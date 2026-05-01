'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Check, Crown, Sparkles, Zap } from 'lucide-react';
import type { PublicPricingData, PublicPricingPackage } from '@/lib/pricing';

function formatMmk(value: number): string {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} MMK`;
}

function PackageCard({
  pkg,
  variant,
}: {
  pkg: PublicPricingPackage;
  variant: 'plan' | 'topup';
}) {
  const t = useTranslations('pricing');
  const isPlan = variant === 'plan';

  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
        pkg.isBestValue
          ? 'border-accent-gold/50 bg-gradient-to-b from-accent-gold/10 via-card to-card shadow-[0_0_40px_-12px_rgba(212,168,83,0.35)] dark:from-accent-gold/15 dark:shadow-[0_0_48px_-12px_rgba(232,201,106,0.25)]'
          : 'border-card-border bg-card/80 hover:border-accent-gold/25'
      }`}
    >
      {pkg.isBestValue && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-accent-gold/40 bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold shadow-sm">
          <Crown className="h-3.5 w-3.5" />
          {t('bestValue')}
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-2 pt-1">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground">{pkg.name}</h3>
          {isPlan ? (
            <p className="mt-1 text-sm text-muted">
              {t('durationLabel', { days: pkg.durationDays })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">{t('topupSubtitle')}</p>
          )}
        </div>
        {isPlan ? (
          <Sparkles className="h-5 w-5 shrink-0 text-accent-gold/80" />
        ) : (
          <Zap className="h-5 w-5 shrink-0 text-accent-purple" />
        )}
      </div>

      <div className="mb-6">
        <p className="text-4xl font-bold tabular-nums tracking-tight text-accent-gold">
          {formatMmk(pkg.price)}
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
          {isPlan ? t('billedOnce') : t('oneTimeCredits')}
        </p>
      </div>

      <ul className="mb-8 flex flex-1 flex-col gap-2.5 text-sm text-muted">
        <li className="flex items-center gap-2 text-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          {t('creditsLine', { points: pkg.creditPoints.toLocaleString() })}
        </li>
        {isPlan && (
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {t('fullStudio')}
          </li>
        )}
      </ul>

      <Link
        href="/signup"
        className={`mt-auto inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
          pkg.isBestValue
            ? 'bg-primary text-primary-fg hover:bg-primary-hover'
            : 'border border-card-border bg-surface/50 text-foreground hover:border-accent-gold/40 hover:bg-surface'
        }`}
      >
        {t('cta')}
      </Link>
    </div>
  );
}

export function PricingClient({ data }: { data: PublicPricingData | null }) {
  const t = useTranslations('pricing');

  return (
    <div className="relative min-w-0 pb-24 pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 flex justify-center"
        aria-hidden
      >
        <div className="h-72 w-[min(100%,48rem)] rounded-full bg-accent-gold-muted blur-3xl opacity-50 dark:opacity-30" />
      </div>

      <header className="relative mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-gold">
          {t('kicker')}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{t('subtitle')}</p>
      </header>

      {!data ? (
        <div className="relative mx-auto max-w-md rounded-3xl border border-card-border bg-card/60 p-10 text-center backdrop-blur-sm">
          <p className="text-muted">{t('loadError')}</p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-accent-gold hover:underline"
          >
            {t('backHome')}
          </Link>
        </div>
      ) : (
        <>
          <section className="relative mb-20">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                  {t('sectionPlans')}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted">{t('sectionPlansDesc')}</p>
              </div>
            </div>
            {data.memberLevelPackages.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-card-border py-12 text-center text-sm text-muted">
                {t('emptyPlans')}
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.memberLevelPackages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} variant="plan" />
                ))}
              </div>
            )}
          </section>

          {data.topupPackages.length > 0 && (
            <section className="relative">
              <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                    {t('sectionTopup')}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-muted">{t('sectionTopupDesc')}</p>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.topupPackages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} variant="topup" />
                ))}
              </div>
            </section>
          )}

          <p className="relative mt-16 text-center text-xs text-muted">{t('footnote')}</p>
        </>
      )}
    </div>
  );
}
