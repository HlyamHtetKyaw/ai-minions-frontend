import { getTranslations } from 'next-intl/server';
import { Link2, ShieldCheck, Zap } from 'lucide-react';

const TRUST_KEYS = ['speed', 'workflow', 'fairUse'] as const;

const ICONS = {
  speed: Zap,
  workflow: Link2,
  fairUse: ShieldCheck,
} as const;

/** Brand-aligned accents: gold (speed), sky (connected flow), purple (trust / pricing clarity) */
const TRUST_VARIANTS: Record<
  (typeof TRUST_KEYS)[number],
  { iconWell: string; cardClass: string }
> = {
  speed: {
    iconWell:
      'bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/25 dark:bg-accent-gold/12 dark:ring-accent-gold/35',
    cardClass:
      'ring-1 ring-accent-gold/30 shadow-[0_0_0_1px_rgba(212,168,83,0.08),0_20px_56px_-24px_rgba(212,168,83,0.28)] dark:shadow-[0_0_0_1px_rgba(232,201,106,0.12),0_24px_64px_-20px_rgba(232,201,106,0.32)]',
  },
  workflow: {
    iconWell:
      'bg-sky-500/12 text-sky-600 ring-1 ring-sky-500/25 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/35',
    cardClass:
      'ring-1 ring-sky-400/25 shadow-[0_0_0_1px_rgba(14,165,233,0.08),0_20px_56px_-24px_rgba(14,165,233,0.2)] dark:shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_24px_64px_-20px_rgba(56,189,248,0.28)]',
  },
  fairUse: {
    iconWell:
      'bg-accent-purple/12 text-accent-purple ring-1 ring-accent-purple/25 dark:bg-accent-purple/10 dark:ring-accent-purple/35',
    cardClass:
      'ring-1 ring-accent-purple/30 shadow-[0_0_0_1px_rgba(167,139,250,0.08),0_20px_56px_-24px_rgba(167,139,250,0.22)] dark:shadow-[0_0_0_1px_rgba(196,181,253,0.12),0_24px_64px_-20px_rgba(196,181,253,0.3)]',
  },
};

export default async function LandingTrust() {
  const tHome = await getTranslations('home');

  return (
    <section className="mb-24 sm:mb-28 lg:mb-32" aria-labelledby="trust-heading">
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16 lg:mb-20">
        <h2
          id="trust-heading"
          className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
        >
          {tHome('landing.trust.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-muted sm:mt-5 sm:text-base">
          {tHome('landing.trust.subtitle')}
        </p>
      </div>

      <ul className="mx-auto grid max-w-6xl list-none grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-6 lg:gap-8">
        {TRUST_KEYS.map((key) => {
          const Icon = ICONS[key];
          const v = TRUST_VARIANTS[key];
          return (
            <li
              key={key}
              className={`flex flex-col rounded-[14px] bg-card/70 p-8 backdrop-blur-sm transition-colors hover:bg-card/85 sm:p-8 ${v.cardClass}`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${v.iconWell}`}
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={2.25} />
                </span>
                <h3 className="min-w-0 flex-1 pt-0.5 text-left text-base font-bold leading-snug text-foreground sm:text-lg">
                  {tHome(`landing.trust.items.${key}.title`)}
                </h3>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-muted sm:text-[0.9375rem]">
                {tHome(`landing.trust.items.${key}.description`)}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted sm:mt-16 sm:text-base">
        {tHome('landing.trust.socialProof')}
      </p>
    </section>
  );
}
