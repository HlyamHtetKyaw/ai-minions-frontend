import { getTranslations } from 'next-intl/server';

const STEP_KEYS = [
  'video-upload',
  'transcribe',
  'content-generation',
  'video-edit',
] as const;

export default async function LandingHowItWorks() {
  const tHome = await getTranslations('home');
  const tWorkflow = await getTranslations('workflow');

  return (
    <section
      className="mb-16 scroll-mt-24"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mb-8 max-w-2xl">
        <h2
          id="how-it-works-heading"
          className="text-lg font-semibold text-foreground sm:text-xl"
        >
          {tHome('landing.howItWorks.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
          {tHome('landing.howItWorks.subtitle')}
        </p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEP_KEYS.map((key, index) => (
          <li
            key={key}
            className="glass-card relative flex flex-col rounded-[22px] border border-card-border p-5"
          >
            <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold/15 text-xs font-bold text-accent-gold">
              {index + 1}
            </span>
            <h3 className="text-base font-semibold text-foreground">
              {tWorkflow(`steps.${key}.name`)}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              {tWorkflow(`steps.${key}.description`)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
