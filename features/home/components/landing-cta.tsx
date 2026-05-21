import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';

export default async function LandingCta() {
  const tHome = await getTranslations('home');

  return (
    <section
      className="relative py-12 sm:py-16 lg:py-20"
      aria-labelledby="landing-cta-heading"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-1/4 h-72 w-72 -translate-y-1/2 rounded-full bg-accent-purple/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-accent-gold/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:max-w-4xl">
        <h2
          id="landing-cta-heading"
          className="text-balance text-3xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.08]"
        >
          {tHome('landing.cta.title')}
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-muted sm:mt-7 sm:text-base lg:mt-8">
          {tHome('landing.cta.subtitle')}
        </p>

        <div className="mx-auto mt-8 grid w-full max-w-sm grid-cols-2 gap-2 sm:mt-10 sm:max-w-md sm:gap-3 lg:mt-12 lg:max-w-lg lg:gap-4">
          <Link
            href="/signup"
            className="inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border-2 border-accent-gold bg-transparent px-2 py-2 text-center text-[11px] font-semibold leading-snug text-foreground outline-none transition hover:bg-accent-gold/10 focus-visible:ring-2 focus-visible:ring-accent-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-11 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
          >
            {tHome('landing.cta.primary')}
            <ChevronRight className="h-3 w-3 shrink-0 opacity-90 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex min-h-9 w-full items-center justify-center gap-0.5 rounded-lg border border-card-border bg-subtle px-2 py-2 text-center text-[11px] font-semibold leading-snug text-muted outline-none transition hover:border-accent-gold/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent-purple/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-11 sm:gap-1.5 sm:px-4 sm:py-3 sm:text-sm"
          >
            {tHome('landing.cta.secondary')}
            <ChevronRight className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
