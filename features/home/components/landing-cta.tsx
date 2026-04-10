import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function LandingCta() {
  const tHome = await getTranslations('home');

  return (
    <section
      className="glass-card relative overflow-hidden rounded-[28px] border border-card-border px-6 py-10 sm:px-10 sm:py-12"
      aria-labelledby="landing-cta-heading"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-gold/10 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-2xl">
        <h2 id="landing-cta-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          {tHome('landing.cta.title')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          {tHome('landing.cta.subtitle')}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/signup"
            className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-fg shadow-lg transition hover:bg-primary-hover"
          >
            {tHome('landing.cta.primary')}
          </Link>
          <Link
            href="/pricing"
            className="inline-flex w-fit items-center justify-center rounded-full border border-card-border bg-subtle/60 px-7 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition hover:border-accent-gold/40"
          >
            {tHome('landing.cta.secondary')}
          </Link>
        </div>
      </div>
    </section>
  );
}
