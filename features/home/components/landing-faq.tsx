import { getTranslations } from 'next-intl/server';
import { ChevronDown, CircleHelp } from 'lucide-react';

const FAQ_KEYS = ['studio', 'credits', 'formats', 'signup'] as const;

export default async function LandingFaq() {
  const tHome = await getTranslations('home');

  return (
    <section className="mb-12 scroll-mt-20 sm:mb-16 lg:mb-20" id="faq" aria-labelledby="faq-heading">
      <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-9 lg:mb-10">
        <h2
          id="faq-heading"
          className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
        >
          {tHome('landing.faq.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-muted sm:mt-5 sm:text-base">
          {tHome('landing.faq.subtitle')}
        </p>
      </header>

      <div className="mx-auto w-full max-w-[min(100%,40rem)] sm:max-w-3xl">
        <div className="border-t border-card-border">
          {FAQ_KEYS.map((key) => (
            <details
              key={key}
              className="group border-b border-card-border px-7 transition-[background-color] duration-300 ease-out open:bg-[color:var(--landing-faq-open-bg)] sm:px-12 lg:px-16"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[2.25rem_1fr_auto] items-center gap-x-4 py-7 marker:hidden outline-none transition-colors duration-300 ease-out focus-visible:ring-2 focus-visible:ring-accent-purple/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-transparent text-foreground transition-[border-color,background-color] duration-300 ease-out dark:border-white/12 group-open:border-accent-purple/35 group-open:bg-accent-purple/5"
                  aria-hidden
                >
                  <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 pr-2 text-left text-base font-bold leading-snug text-foreground">
                  {tHome(`landing.faq.items.${key}.question`)}
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-foreground opacity-80 transition-transform duration-300 ease-out group-open:rotate-180"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </summary>
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr] motion-reduce:transition-none">
                <div className="min-h-0 overflow-hidden">
                  <p className="pb-8 pl-13 pt-1 text-sm leading-relaxed text-muted">
                    {tHome(`landing.faq.items.${key}.answer`)}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
