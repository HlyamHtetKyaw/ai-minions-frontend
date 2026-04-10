import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { FEATURES } from '@/features';

export default async function HeroOverview() {
  const tHome = await getTranslations('home');
  const captionStudioHref =
    FEATURES.find((f) => f.key === 'transcribe')?.href ?? FEATURES[0]?.href ?? '/transcribe';

  return (
    <section className="mb-14 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
      <div className="flex flex-col justify-center">
        <h1 className="mb-4 max-w-xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.35rem] lg:leading-[1.15]">
          {tHome('toolsPage.heroTitle')}
        </h1>
        <p className="mb-8 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          {tHome('toolsPage.heroDescription')}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href={captionStudioHref}
            className="landing-home-primary inline-flex w-fit items-center justify-center rounded-full px-7 py-3 text-sm font-bold shadow-lg"
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
          {(['captions', 'dubbing', 'news']).map((key) => (
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
  );
}
