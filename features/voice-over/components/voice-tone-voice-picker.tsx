'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Pause, Play } from 'lucide-react';
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

function voicePreviewSrcForId(voiceId: string): string {
  const id = (voiceId ?? '').trim().toLowerCase();
  return `/vopreview/${encodeURIComponent(id)}.mp3`;
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

  const normalizedSelected = useMemo(() => {
    const match = voicesInTone.find((m) => m.id.toLowerCase() === selectedVoiceId.toLowerCase());
    return match?.id ?? voicesInTone[0]?.id ?? '';
  }, [selectedVoiceId, voicesInTone]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const loadingWatchdogRef = useRef<number | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const clearLoading = () => {
      setPreviewLoading(false);
      if (loadingWatchdogRef.current != null) {
        window.clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
    };

    const onEnded = () => {
      setPreviewingVoiceId(null);
      clearLoading();
      setIsPreviewPlaying(false);
    };
    const onError = () => {
      setPreviewingVoiceId(null);
      clearLoading();
      setIsPreviewPlaying(false);
      setPreviewError(t('previewUnavailable'));
    };
    const onPlaying = () => {
      clearLoading();
      setPreviewError(null);
      setIsPreviewPlaying(true);
    };
    const onWaiting = () => {
      setPreviewLoading(true);
    };
    const onPause = () => {
      // If user pauses manually, keep UI consistent.
      clearLoading();
      setIsPreviewPlaying(false);
    };
    const onCanPlay = () => {
      // Some browsers may not emit `playing` reliably for short clips; don't keep spinners up.
      clearLoading();
    };
    const onLoadedData = () => {
      clearLoading();
    };
    const onStalled = () => {
      clearLoading();
    };
    const onAbort = () => {
      clearLoading();
    };
    const onSuspend = () => {
      clearLoading();
    };

    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('pause', onPause);
    a.addEventListener('canplay', onCanPlay);
    a.addEventListener('loadeddata', onLoadedData);
    a.addEventListener('stalled', onStalled);
    a.addEventListener('abort', onAbort);
    a.addEventListener('suspend', onSuspend);
    return () => {
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('canplay', onCanPlay);
      a.removeEventListener('loadeddata', onLoadedData);
      a.removeEventListener('stalled', onStalled);
      a.removeEventListener('abort', onAbort);
      a.removeEventListener('suspend', onSuspend);
      if (loadingWatchdogRef.current != null) {
        window.clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
    };
  }, [t]);

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

    const a = audioRef.current;
    if (a) a.pause();
    setPreviewingVoiceId(null);
    setPreviewLoading(false);
    setIsPreviewPlaying(false);
    if (loadingWatchdogRef.current != null) {
      window.clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }
  };

  const stopPreview = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setPreviewingVoiceId(null);
    setPreviewLoading(false);
    setIsPreviewPlaying(false);
    if (loadingWatchdogRef.current != null) {
      window.clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }
  };

  const togglePreview = async (voiceId: string) => {
    const a = audioRef.current;
    if (!a) return;
    if (disabled) return;

    const want = (voiceId ?? '').trim();
    if (!want) return;

    const isSame = previewingVoiceId?.toLowerCase() === want.toLowerCase();
    // Single button behavior:
    // - if currently playing this same voice -> STOP (pause + reset)
    // - otherwise -> start (or restart) playback
    if (isSame && isPreviewPlaying) {
      stopPreview();
      return;
    }

    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewingVoiceId(want);
    setIsPreviewPlaying(false);
    a.pause();
    a.currentTime = 0;
    a.src = voicePreviewSrcForId(want);
    // Watchdog: if the browser never reaches `playing`, don't leave spinner stuck.
    if (loadingWatchdogRef.current != null) {
      window.clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }
    loadingWatchdogRef.current = window.setTimeout(() => {
      // If we never got a terminal event, stop showing "loading".
      setPreviewLoading(false);
      loadingWatchdogRef.current = null;
    }, 3500);
    try {
      await a.play();
    } catch {
      stopPreview();
      setPreviewError(t('previewUnavailable'));
    }
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
        <p className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-slate-400">
          {t('step2')}
        </p>

        <audio ref={audioRef} preload="none" className="hidden" />

        <div className="space-y-2">
          {previewError ? (
            <p className="text-[11px] text-red-600 dark:text-red-300">{previewError}</p>
          ) : (
            <p className="text-[11px] text-zinc-600 dark:text-slate-400">{t('previewHint')}</p>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {voicesInTone.map((m) => {
              const checked = m.id.toLowerCase() === normalizedSelected.toLowerCase();
              const isPlaying = isPreviewPlaying && previewingVoiceId?.toLowerCase() === m.id.toLowerCase();
              const isRowLoading = previewLoading && previewingVoiceId?.toLowerCase() === m.id.toLowerCase();
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    checked
                      ? 'border-violet-500/60 bg-violet-500/10'
                      : 'border-card-border bg-card/40 hover:bg-card/60'
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="voice-over-voice"
                      className="shrink-0"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onVoiceIdChange(m.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {formatVoiceIdDisplay(m.id)}
                      </span>
                      {m.style ? (
                        <span className="block truncate text-[11px] text-muted-foreground">{m.style}</span>
                      ) : null}
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={disabled || isRowLoading}
                    onClick={() => void togglePreview(m.id)}
                    className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-card-border bg-card text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    aria-label={isPlaying ? t('pausePreview') : t('playPreview')}
                    title={isPlaying ? t('pausePreview') : t('playPreview')}
                  >
                    {isRowLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
