'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { VoiceModelDescriptor } from '@/lib/voice-over-api';
import {
  VOICE_TONE_GROUP_IDS,
  type VoiceToneGroupId,
  voicesForToneGroup,
} from '@/lib/voice-over-tone-groups';

function formatVoiceIdDisplay(id: string): string {
  const t = (id ?? '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

type Props = {
  catalog: VoiceModelDescriptor[];
  loading: boolean;
  error: string | null;
  toneGroupId: VoiceToneGroupId;
  onToneGroupChange: (tone: VoiceToneGroupId) => void;
  selectedVoiceId: string;
  onVoiceIdChange: (id: string) => void;
  disabled?: boolean;
};

export default function VoiceToneVoicePicker({
  catalog,
  loading,
  error,
  toneGroupId,
  onToneGroupChange,
  selectedVoiceId,
  onVoiceIdChange,
  disabled,
}: Props) {
  const t = useTranslations('voice-over.tonePicker');
  const tGroups = useTranslations('voice-over.toneGroups');

  const voicesInTone = useMemo(() => voicesForToneGroup(catalog, toneGroupId), [catalog, toneGroupId]);

  const toneOptions = useMemo(() => {
    return VOICE_TONE_GROUP_IDS.map((id) => ({
      id,
      count: voicesForToneGroup(catalog, id).length,
      title: tGroups(`${id}.title`),
      hint: tGroups(`${id}.hint`),
    })).filter((o) => o.count > 0);
  }, [catalog, tGroups]);

  const selectValue = useMemo(() => {
    const match = voicesInTone.find((m) => m.id.toLowerCase() === selectedVoiceId.toLowerCase());
    return match?.id ?? voicesInTone[0]?.id ?? '';
  }, [voicesInTone, selectedVoiceId]);

  if (loading) {
    return <p className="text-xs text-muted-foreground sm:text-sm">{t('loadingVoices')}</p>;
  }
  if (error) {
    return <p className="text-xs text-red-300 sm:text-sm">{error}</p>;
  }
  if (catalog.length === 0) {
    return <p className="text-xs text-muted-foreground sm:text-sm">{t('emptyCatalog')}</p>;
  }

  const handleToneClick = (id: VoiceToneGroupId) => {
    onToneGroupChange(id);
    const first = voicesForToneGroup(catalog, id)[0]?.id;
    if (first) onVoiceIdChange(first);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('step1')}</p>
        <div className="flex flex-col gap-2">
          {toneOptions.map((opt) => {
            const pressed = toneGroupId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => handleToneClick(opt.id)}
                aria-pressed={pressed}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  pressed
                    ? 'border-violet-500/50 bg-violet-500/10 text-foreground'
                    : 'border-card-border bg-card/60 text-foreground hover:border-foreground/30 hover:bg-card'
                }`}
              >
                <span className="block text-xs font-semibold sm:text-sm">{opt.title}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="voice-over-voice-select"
          className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {t('step2')}
        </label>
        <select
          id="voice-over-voice-select"
          value={selectValue}
          onChange={(e) => onVoiceIdChange(e.target.value)}
          disabled={disabled || voicesInTone.length === 0}
          className="h-10 w-full max-w-md rounded-lg border border-card-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
        >
          {voicesInTone.map((m) => (
            <option key={m.id} value={m.id}>
              {formatVoiceIdDisplay(m.id)}
              {m.style ? ` — ${m.style}` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
