import { Link } from '@/i18n/navigation';
import { FEATURES } from '@/features';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';

const CARD_ACCENTS = [
  'bg-blue-500 shadow-blue-500/30',
  'bg-emerald-500 shadow-emerald-500/30',
  'bg-rose-500 shadow-rose-500/30',
  'bg-amber-500 shadow-amber-500/30',
  'bg-violet-500 shadow-violet-500/30',
  'bg-cyan-500 shadow-cyan-500/30',
  'bg-fuchsia-500 shadow-fuchsia-500/30',
] as const;

export default async function Home() {
  const tHome = await getTranslations('home');
  const tFeatures = await getTranslations('features');
  const captionStudioHref =
    FEATURES.find((f) => f.key === 'transcribe')?.href ?? FEATURES[0]?.href ?? '/transcribe';

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      {/* Hero + overview */}
      <section className="mb-14 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
        <div className="flex flex-col justify-center">
          <h1 className="mb-4 max-w-xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.35rem] lg:leading-[1.15]">
            {tHome('heroTitle')}
          </h1>
          <p className="mb-8 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            {tHome('heroDescription')}
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={captionStudioHref}
              className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-fg shadow-lg transition hover:bg-primary-hover"
            >
              {tHome('openStudio')}
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span>{tHome('signedInStatus')}</span>
            </div>
          </div>
        </div>

        <aside className="glass-card relative overflow-hidden rounded-[28px] p-6 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                {tHome('overview.title')}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">{tHome('overview.subtitle')}</p>
            </div>
            <span className="shrink-0 rounded-full bg-status-live/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-purple">
              {tHome('overview.live')}
            </span>
          </div>
          <div className="grid gap-3">
            {(['captions', 'dubbing', 'news'] as const).map((key) => (
              <div
                key={key}
                className="rounded-2xl border border-card-border bg-subtle/80 px-4 py-3.5 backdrop-blur-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {tHome(`overview.items.${key}.kicker`)}
                </p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {tHome(`overview.items.${key}.headline`)}
                </p>
                <p className="mt-1 text-sm text-muted leading-snug">
                  {tHome(`overview.items.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {/* Feature grid */}
      <section id="tools" aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="mb-6 text-lg font-semibold text-foreground sm:text-xl">
          {tHome('allTools')}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
            const category = tFeatures(`${feature.key}.category`);
            const Icon = feature.icon;

            return (
              <Link
                key={feature.key}
                href={feature.href}
                className="group glass-card relative flex min-h-[200px] flex-col rounded-[26px] p-6 transition hover:border-accent-gold/30 hover:shadow-xl"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg ${accent}`}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                  </span>
                  <span className="max-w-[52%] text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted">
                    {category}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground group-hover:underline">
                  {tFeatures(`${feature.key}.name`)}
                </h3>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-muted">
                  {tFeatures(`${feature.key}.description`)}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-available">
                    {tHome('available')}
                  </span>
                  <span className="text-sm font-medium text-accent-gold transition group-hover:translate-x-0.5">
                    {tHome('openCardLink')} →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
