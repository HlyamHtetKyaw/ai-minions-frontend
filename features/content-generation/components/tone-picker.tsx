'use client';

import { useTranslations } from 'next-intl';

export const TONE_KEYS = [
  'engaging',
  'professional',
  'casual',
  'funny',
  'inspiring',
  'dramatic',
] as const;
export type ToneKey = (typeof TONE_KEYS)[number];

interface Props {
  value: ToneKey;
  onChange: (value: ToneKey) => void;
}

export default function TonePicker({ value, onChange }: Props) {
  const t = useTranslations('contentGeneration');

  return (
    <section className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {t('toneLabel')}
      </p>
      <div
        className="flex flex-wrap items-center gap-2 sm:gap-2.5"
        role="group"
        aria-label={t('toneLabel')}
      >
        {TONE_KEYS.map((key) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={selected}
              className={`tone-chip ${selected ? 'tone-chip-active' : ''}`}
            >
              {t(`tones.${key}`)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
