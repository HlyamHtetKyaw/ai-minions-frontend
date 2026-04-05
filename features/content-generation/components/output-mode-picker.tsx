'use client';

import { useTranslations } from 'next-intl';
import { FileText, Image as ImageIcon, Layers, type LucideIcon } from 'lucide-react';

export const OUTPUT_MODE_KEYS = ['imageAndText', 'textOnly', 'imageOnly'] as const;
export type OutputModeKey = (typeof OUTPUT_MODE_KEYS)[number];

const OUTPUT_MODE_ICONS: Record<OutputModeKey, LucideIcon> = {
  imageAndText: Layers,
  textOnly: FileText,
  imageOnly: ImageIcon,
};

interface Props {
  value: OutputModeKey;
  onChange: (value: OutputModeKey) => void;
}

export default function OutputModePicker({ value, onChange }: Props) {
  const t = useTranslations('contentGeneration');

  return (
    <section className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {t('outputModeLabel')}
      </p>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="group"
        aria-label={t('outputModeLabel')}
      >
        {OUTPUT_MODE_KEYS.map((key) => {
          const Icon = OUTPUT_MODE_ICONS[key];
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={selected}
              className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-3.5 text-left transition sm:min-h-22 ${
                selected
                  ? 'border-fuchsia-500/70 bg-fuchsia-500/10 shadow-[0_0_0_1px_rgba(232,121,249,0.35)]'
                  : 'border-card-border bg-subtle/60 hover:border-fuchsia-500/35'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${selected ? 'text-fuchsia-400' : 'text-muted'}`}
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="text-sm font-semibold text-foreground">
                {t(`outputModes.${key}`)}
              </span>
              <span className="text-xs leading-snug text-muted">
                {t(`outputModeHints.${key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
