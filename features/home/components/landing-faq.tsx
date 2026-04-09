import { getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';

const FAQ_KEYS = ['studio', 'credits', 'formats', 'signup'] as const;

export default async function LandingFaq() {
  const tHome = await getTranslations('home');

  return (
    <section className="mb-16 scroll-mt-24" id="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-6 text-lg font-semibold text-foreground sm:text-xl">
        {tHome('landing.faq.title')}
      </h2>
      <div className="max-w-3xl space-y-3">
        {FAQ_KEYS.map((key) => (
          <details
            key={key}
            className="group glass-card rounded-[22px] border border-card-border px-5 py-4 transition open:border-accent-gold/25"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
              <span>{tHome(`landing.faq.items.${key}.question`)}</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-3 border-t border-card-border pt-3 text-sm leading-relaxed text-muted">
              {tHome(`landing.faq.items.${key}.answer`)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
