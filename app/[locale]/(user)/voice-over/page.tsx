'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Mic } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import VoiceSelector from '@/components/shared/components/voice-selector';
import AudioPlayer from '@/components/shared/components/audio-player';
import type { VoiceStyle } from '@/components/shared/types';
import PageHeader from '@/components/layout/page-header';
import GenerateButton from '@/features/voice-over/components/generate-button';
import { voiceOverEstimatePoints, voiceOverStart, openVoiceOverSse } from '@/lib/voice-over-api';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';

// TODO: replace with real auth state
const isSignedIn = true;

type ProviderChoice = 'auto' | 'gemini' | 'openai';

export default function VoiceOverPage() {
  const t = useTranslations('voice-over');

  const [scriptText, setScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle>('woman');
  const [provider, setProvider] = useState<ProviderChoice>('auto');
  const [audioSrc, setAudioSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateUnavailable, setEstimateUnavailable] = useState(false);

  const canGenerate = useMemo(() => scriptText.trim().length > 0 && !isLoading, [scriptText, isLoading]);

  const handleGenerate = async () => {
    const text = scriptText.trim();
    if (!text) return;
    setIsLoading(true);
    setError(null);
    setAudioSrc('');
    setEstimateCost(null);
    setEstimateUnavailable(false);
    setEstimateLoading(true);
    setProgress({ percent: 10, label: t('progress.estimating') });
    try {
      try {
        const est = await voiceOverEstimatePoints(text);
        const pts = est.reserveCostPoints;
        if (typeof pts === 'number' && Number.isFinite(pts)) {
          setEstimateCost(pts);
          setEstimateUnavailable(false);
        } else {
          setEstimateUnavailable(true);
        }
      } catch {
        setEstimateUnavailable(true);
      } finally {
        setEstimateLoading(false);
      }

      setProgress({ percent: 25, label: t('progress.starting') });
      const started = await voiceOverStart({
        text,
        style: selectedVoice,
        provider: provider === 'auto' ? null : provider.toUpperCase(),
      });

      openVoiceOverSse(started.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setProgress(p);
        },
        onDone: () => {},
        onError: (msg) => {
          setError(msg);
          setProgress(null);
        },
        onTerminal: (payload) => {
          if (payload.status === 'completed' && payload.data && typeof payload.data === 'object') {
            const d = payload.data as Record<string, unknown>;
            const url = typeof d.audioUrl === 'string' ? d.audioUrl : '';
            if (url) {
              setAudioSrc(url);
              setProgress({ percent: 100, label: t('progress.finished') });
              return;
            }
          }
          setError(payload.message ?? 'Voice over failed');
          setProgress(null);
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">
            <div className="voice-over-shell space-y-10">
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="content-creator-icon-tile">
                    <Mic className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />

              <ScriptInput
                value={scriptText}
                onChange={setScriptText}
                kicker={t('scriptInput.kicker')}
                placeholder={t('scriptInput.placeholder')}
                exampleHint={t('scriptInput.example')}
                variant="voiceStudio"
                showCharacterCount={false}
                disabled={isLoading}
              />

              <VoiceSelector
                value={selectedVoice}
                onChange={setSelectedVoice}
                variant="chips"
                inlineEnd={
                  <div className="ml-auto flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
                    <span
                      className="mx-0.5 hidden h-5 w-px shrink-0 bg-card-border sm:block"
                      aria-hidden
                    />
                    <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {t('provider.label')}
                    </p>
                    <div className="voice-provider-select-wrap shrink-0">
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as ProviderChoice)}
                        className="voice-provider-select"
                        disabled={isLoading}
                        aria-label={t('provider.aria')}
                      >
                        <option value="auto">{t('provider.auto')}</option>
                        <option value="gemini">{t('provider.gemini')}</option>
                        <option value="openai">{t('provider.openai')}</option>
                      </select>
                      <ChevronDown className="voice-provider-select-chevron" strokeWidth={2.25} aria-hidden />
                    </div>
                  </div>
                }
              />

              <div className="rounded-xl border border-violet-500/25 bg-violet-500/6 px-4 py-4 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {t('estimate.kicker')}
                </p>
                {estimateLoading ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('estimate.loading')}</p>
                ) : estimateCost != null ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                        {estimateCost.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">{t('estimate.unit')}</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('estimate.caption')}</p>
                  </>
                ) : estimateUnavailable ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('estimate.unavailable')}</p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('estimate.hint')}</p>
                )}
              </div>

              <GenerateButton
                onClick={handleGenerate}
                isLoading={isLoading}
                disabled={!canGenerate}
              />

              {progress ? (
                <div
                  className={`rounded-xl border border-card-border bg-card px-4 py-3 ${
                    progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`text-sm ${
                        progress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {progress.label}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground tabular-nums">{progress.percent}%</p>
                  </div>
                  <div
                    className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-subtle"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress.percent}
                    aria-label={progress.label}
                  >
                    <div
                      className={`h-2.5 rounded-full transition-[width] duration-300 ease-out ${
                        progress.percent >= 100 ? 'bg-emerald-600' : 'bg-violet-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              {audioSrc ? (
                <AudioPlayer src={audioSrc} filename="voice-over.mp3" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
