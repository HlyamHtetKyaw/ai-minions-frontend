import { Link } from '@/i18n/navigation';
import { AppPathname } from '@/i18n/routing';
import type { ComponentType } from 'react';

type FeatureCardProps = {
  href: AppPathname;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  accent: string;
  category: string;
  name: string;
  description: string;
  availableLabel: string;
  openCardLabel: string;
};

export default function FeatureCard({
  href,
  icon: Icon,
  accent,
  category,
  name,
  description,
  availableLabel,
  openCardLabel,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group glass-card relative flex min-h-50 flex-col rounded-[26px] p-6 transition hover:border-accent-gold/30 hover:shadow-xl"
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
      <h3 className="mb-2 text-lg font-bold text-foreground group-hover:underline">{name}</h3>
      <p className="mb-6 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-available">
          {availableLabel}
        </span>
        <span className="text-sm font-medium text-accent-gold transition group-hover:translate-x-0.5">
          {openCardLabel} →
        </span>
      </div>
    </Link>
  );
}
