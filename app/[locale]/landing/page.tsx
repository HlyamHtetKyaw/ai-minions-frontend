import { Link } from '@/i18n/navigation';
import { FEATURES } from '@/features';
import { getTranslations } from 'next-intl/server';
import LandingHowItWorks from '@/features/home/components/landing-how-it-works';
import LandingTrust from '@/features/home/components/landing-trust';
import LandingFaq from '@/features/home/components/landing-faq';
import LandingCta from '@/features/home/components/landing-cta';

export default async function LandingPage() {
  const tHome = await getTranslations('home');
  const tFeatures = await getTranslations('features');

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
      <section className="mb-14 grid gap-7 rounded-[30px] border border-card-border bg-subtle/40 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
            AI Minions
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {tHome('heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {tHome('heroDescription')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
            >
              {tHome('landing.cta.primary')}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-card-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:border-accent-gold/40"
            >
              {tHome('landing.cta.secondary')}
            </Link>
          </div>
        </div>

        <div className="glass-card rounded-[24px] border border-card-border p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Product snapshot
          </p>
          <ul className="mt-4 space-y-3">
            {FEATURES.slice(0, 4).map((feature) => (
              <li
                key={feature.key}
                className="flex items-center justify-between rounded-xl border border-card-border bg-card/50 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-foreground">
                  {tFeatures(`${feature.key}.name`)}
                </span>
                <Link href={feature.href} className="text-xs font-semibold text-accent-gold">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LandingHowItWorks />
      <section className="mb-16" aria-labelledby="tool-preview-heading">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="tool-preview-heading" className="text-lg font-semibold text-foreground sm:text-xl">
            {tHome('allTools')}
          </h2>
          <Link href="/" className="text-sm font-medium text-accent-gold">
            Open dashboard
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link
              key={feature.key}
              href={feature.href}
              className="group rounded-2xl border border-card-border bg-card/40 p-5 transition hover:border-accent-gold/35"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {tFeatures(`${feature.key}.category`)}
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {tFeatures(`${feature.key}.name`)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tFeatures(`${feature.key}.description`)}
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-accent-gold">
                {tHome('openCardLink')}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <LandingTrust />
      <LandingFaq />
      <LandingCta />
    </div>
  );
}
