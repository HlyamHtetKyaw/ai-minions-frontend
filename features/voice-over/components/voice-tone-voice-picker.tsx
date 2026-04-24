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
    return <p className="text-xs text-zinc-600 sm:text-sm dark:text-slate-400">{t('loadingVoices')}</p>;
  }
  if (error) {
    return <p className="text-xs text-red-600 sm:text-sm dark:text-red-300">{error}</p>;
  }
  if (catalog.length === 0) {
    return <p className="text-xs text-zinc-600 sm:text-sm dark:text-slate-400">{t('emptyCatalog')}</p>;
  }

  const handleToneClick = (id: VoiceToneGroupId) => {
    onToneGroupChange(id);
    const first = voicesForToneGroup(catalog, id)[0]?.id;
    if (first) onVoiceIdChange(first);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-slate-400">
          {t('step1')}
        </p>
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
                    ? 'border-violet-500 bg-violet-50 text-zinc-900 ring-2 ring-violet-400/40 dark:border-violet-400 dark:bg-violet-950/90 dark:text-slate-100 dark:ring-violet-400/35'
                    : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/18 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-white/28 dark:hover:bg-slate-700/90'
                }`}
              >
                <span className="block text-xs font-semibold sm:text-sm">{opt.title}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-zinc-600 sm:text-[11px] dark:text-slate-400">
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
          className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-slate-400"
        >
          {t('step2')}
        </label>
        <select
          id="voice-over-voice-select"
          value={selectValue}
          onChange={(e) => onVoiceIdChange(e.target.value)}
          disabled={disabled || voicesInTone.length === 0}
          className="h-10 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400/50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
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
