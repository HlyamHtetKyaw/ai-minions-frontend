import { getTranslations } from 'next-intl/server';
import { Layers, ShieldCheck, Zap } from 'lucide-react';

const TRUST_KEYS = ['speed', 'workflow', 'fairUse'] as const;

const ICONS = {
  speed: Zap,
  workflow: Layers,
  fairUse: ShieldCheck,
} as const;

export default async function LandingTrust() {
  const tHome = await getTranslations('home');

  return (
    <section className="mb-16" aria-labelledby="trust-heading">
      <div className="mb-8 max-w-2xl">
        <h2 id="trust-heading" className="text-lg font-semibold text-foreground sm:text-xl">
          {tHome('landing.trust.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
          {tHome('landing.trust.subtitle')}
        </p>
      </div>
      <ul className="grid gap-5 sm:grid-cols-3">
        {TRUST_KEYS.map((key) => {
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              className="glass-card flex flex-col rounded-[22px] border border-card-border p-6"
            >
              <span
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/15 text-accent-purple"
                aria-hidden
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <h3 className="text-base font-semibold text-foreground">
                {tHome(`landing.trust.items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tHome(`landing.trust.items.${key}.description`)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
