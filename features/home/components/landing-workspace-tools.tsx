import { Link } from '@/i18n/navigation';
import { FEATURES, type FeatureConfig } from '@/features';
import { getTranslations } from 'next-intl/server';
import { FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<
  string,
  FeatureConfig
>;

const FLOW_STEP_KEYS = [
  'upload',
  'transcribe',
  'translate',
  'edit',
  'voiceOver',
] as const;

/** Tool keys per mockup section order */
const SECTIONS = [
  { sectionKey: 'startHere' as const, toolKeys: ['viral-shorts'] as const },
  { sectionKey: 'process' as const, toolKeys: ['transcribe', 'translate'] as const },
  {
    sectionKey: 'createEdit' as const,
    toolKeys: ['video-edit', 'voice-over', 'content-generation'] as const,
  },
] as const;

const LANDING_ICON: Partial<Record<string, LucideIcon>> = {
  'content-generation': FileText,
};

/** Unified workspace-tool icon treatment (lavender on indigo well) */
const WORKSPACE_ICON_WELL =
  'flex shrink-0 items-center justify-center rounded-full bg-[#2D3261] shadow-md shadow-black/25';
const WORKSPACE_ICON_COLOR = 'text-[#C8B6FF]';

function StartHereCard({
  feature,
  name,
  description,
  cta,
  recommendedLabel,
}: {
  feature: FeatureConfig;
  name: string;
  description: string;
  cta: string;
  recommendedLabel: string;
}) {
  const Icon = (LANDING_ICON[feature.key] ?? feature.icon) as LucideIcon;

  return (
    <Link
      href={feature.href}
      className="group relative flex w-full flex-col gap-6 overflow-hidden rounded-xl border-2 border-sky-500/75 bg-card/70 p-6 shadow-[0_0_36px_-10px_rgba(56,189,248,0.45)] transition hover:border-sky-400 hover:bg-card/80 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8"
    >
      <span className="absolute right-4 top-4 text-xs font-bold uppercase tracking-wide text-amber-400">
        {recommendedLabel}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6 sm:pr-28">
        <span className={`${WORKSPACE_ICON_WELL} h-14 w-14`} aria-hidden>
          <Icon className={`h-7 w-7 ${WORKSPACE_ICON_COLOR}`} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{name}</h3>
          <p className="mt-1.5 text-sm leading-snug text-muted sm:text-base">{description}</p>
        </div>
      </div>
      <span className="landing-home-primary landing-home-primary--group inline-flex w-full shrink-0 items-center justify-center rounded-full px-8 py-3 text-sm font-bold shadow-md sm:w-auto">
        {cta}
      </span>
    </Link>
  );
}

function CompactToolCard({
  feature,
  name,
  description,
  cta,
}: {
  feature: FeatureConfig;
  name: string;
  description: string;
  cta: string;
}) {
  const Icon = (LANDING_ICON[feature.key] ?? feature.icon) as LucideIcon;

  return (
    <Link
      href={feature.href}
      className="group flex min-h-[200px] flex-col rounded-xl bg-card/55 p-5 ring-1 ring-foreground/8 transition hover:bg-card/70 hover:ring-foreground/12 sm:min-h-[220px] sm:p-6"
    >
      <div className="flex flex-1 flex-col">
        <span className={`${WORKSPACE_ICON_WELL} h-12 w-12`} aria-hidden>
          <Icon className={`h-6 w-6 ${WORKSPACE_ICON_COLOR}`} strokeWidth={2} />
        </span>
        <h3 className="mt-4 text-base font-bold tracking-tight text-foreground sm:text-lg">
          {name}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-snug text-muted">{description}</p>
      </div>
      <div className="mt-5 flex justify-end">
        <span className="landing-home-primary landing-home-primary--group rounded-full px-5 py-2.5 text-sm font-bold shadow-sm">
          {cta}
        </span>
      </div>
    </Link>
  );
}

export default async function LandingWorkspaceTools() {
  const tHome = await getTranslations('home');
  const tFeatures = await getTranslations('features');
  const ctaStart = tHome('landing.workspaceTools.ctaStart');

  const flowParts = FLOW_STEP_KEYS.map((step) =>
    tHome(`landing.workspaceTools.flow.steps.${step}`),
  );
  const flowLead = tHome('landing.workspaceTools.flow.leadMark').trim();
  const flowLine = `${flowLead} ${flowParts.join(' → ')}`;

  return (
    <section className="mb-12 sm:mb-16 lg:mb-20" aria-labelledby="tool-preview-heading">
      <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
        <h2
          id="tool-preview-heading"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          {tHome('allTools')}
        </h2>
        <p className="mt-3 text-pretty text-base leading-relaxed text-muted sm:text-lg">
          {tHome('landing.workspaceTools.subtitle')}
        </p>
        <Link
          href="/tools"
          className="mt-5 inline-block text-sm font-semibold text-accent-gold transition hover:underline"
        >
          {tHome('landing.workspaceTools.dashboardLink')}
        </Link>
      </div>

      <p
        className="mb-8 text-center text-sm font-semibold tracking-tight text-amber-500 sm:mb-10 sm:text-base dark:text-[#e8c96a]"
        aria-label={flowLine}
      >
        {flowLine}
      </p>

      <div className="flex flex-col gap-8 sm:gap-10 lg:gap-12">
        {SECTIONS.map(({ sectionKey, toolKeys }) => {
          const startHereFeature =
            sectionKey === 'startHere' ? FEATURE_BY_KEY[toolKeys[0]] : undefined;

          return (
            <div key={sectionKey}>
            <h3 className="mb-3 text-lg font-bold tracking-tight text-foreground sm:mb-4 sm:text-xl">
              {tHome(`landing.workspaceTools.sections.${sectionKey}.title`)}
            </h3>

            {sectionKey === 'startHere' && startHereFeature ? (
              <StartHereCard
                feature={startHereFeature}
                name={tFeatures(`${toolKeys[0]}.name`)}
                description={tHome(`landing.workspaceTools.descriptions.${toolKeys[0]}`)}
                cta={ctaStart}
                recommendedLabel={tHome('landing.workspaceTools.recommended')}
              />
            ) : sectionKey !== 'startHere' ? (
              <div
                className={
                  sectionKey === 'process'
                    ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6'
                    : 'grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7'
                }
              >
                {toolKeys.map((key) => {
                  const feature = FEATURE_BY_KEY[key];
                  if (!feature) return null;
                  return (
                    <CompactToolCard
                      key={key}
                      feature={feature}
                      name={tFeatures(`${key}.name`)}
                      description={tHome(`landing.workspaceTools.descriptions.${key}`)}
                      cta={ctaStart}
                    />
                  );
                })}
              </div>
            ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
