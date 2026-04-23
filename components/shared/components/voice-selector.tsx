'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Volume2 } from 'lucide-react';
import type { VoiceStyle } from '../types';

type Props = {
  value: VoiceStyle | '';
  onChange: (value: VoiceStyle) => void;
  variant?: 'default' | 'chips';
  /** When set with `variant="chips"`, voice label, chips, and this node share one flex row (wraps on narrow viewports). */
  inlineEnd?: ReactNode;
};

const VOICE_OPTIONS: VoiceStyle[] = ['woman', 'man', 'boy', 'girl'];

export default function VoiceSelector({ value, onChange, variant = 'default', inlineEnd }: Props) {
  const t = useTranslations('shared.voiceSelector');

  if (variant === 'chips') {
    const label = (
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t('label')}</p>
    );
    const chips = (
      <div
        className={`flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5 ${inlineEnd ? 'min-w-[min(100%,12rem)] flex-1' : ''}`}
        role="group"
        aria-label={t('label')}
      >
        {VOICE_OPTIONS.map((voice) => {
          const selected = value === voice;
          return (
            <button
              key={voice}
              type="button"
              onClick={() => onChange(voice)}
              aria-pressed={selected}
              className={`voice-style-chip ${selected ? 'voice-style-chip-active' : ''}`}
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              {t(voice)}
            </button>
          );
        })}
      </div>
    );

    if (inlineEnd) {
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:gap-x-4">
          {label}
          {chips}
          {inlineEnd}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {label}
        {chips}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{t('label')}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VOICE_OPTIONS.map((voice) => (
          <button
            key={voice}
            type="button"
            onClick={() => onChange(voice)}
            className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
              value === voice
                ? 'border-transparent bg-primary text-primary-fg'
                : 'border-card-border bg-card text-foreground hover:border-foreground'
            }`}
          >
            {t(voice)}
          </button>
        ))}
      </div>
    </div>
  );
}
