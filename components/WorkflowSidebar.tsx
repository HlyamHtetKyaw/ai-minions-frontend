'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FEATURES } from '@/features';

type Props = {
  currentStep: number;
};

export default function WorkflowSidebar({ currentStep }: Props) {
  const t = useTranslations('workflow');
  const activeFeature = FEATURES[currentStep - 1];

  return (
    <aside className="w-full shrink-0 space-y-3 md:w-70">
      {/* Stepper */}
      <div className="rounded-xl border border-card-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
          {t('heading')}
        </p>
        <ol className="space-y-1">
          {FEATURES.map((feature, index) => {
            const step = index + 1;
            const isActive = step === currentStep;
            const isCompleted = step < currentStep;

            const badge = (
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-fg'
                    : isCompleted
                    ? 'bg-surface text-muted'
                    : 'border border-card-border text-muted'
                }`}
              >
                {step}
              </span>
            );

            const label = (
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium leading-tight ${
                    isActive ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {t(`steps.${feature.key}.name` as string)}
                </p>
                <p className="truncate text-xs text-muted">
                  {t(`steps.${feature.key}.description` as string)}
                </p>
              </div>
            );

            return (
              <li key={feature.key}>
                {isActive ? (
                  <div
                    className="flex items-center gap-3 rounded-lg bg-surface px-2 py-2"
                    aria-current="step"
                  >
                    {badge}
                    {label}
                  </div>
                ) : (
                  <Link
                    href={feature.href}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface"
                  >
                    {badge}
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Tip card */}
      <div className="rounded-xl border border-card-border bg-card p-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          💡 {t('tipHeading')}
        </p>
        <p className="text-sm leading-relaxed text-muted">
          {t(`tips.${activeFeature.key}` as string)}
        </p>
      </div>
    </aside>
  );
}
