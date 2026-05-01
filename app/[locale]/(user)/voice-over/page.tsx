'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import AudioPlayer from '@/components/shared/components/audio-player';
import ProgressBar from '@/components/shared/components/progress-bar';
import PageHeader from '@/components/layout/page-header';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import GenerateButton from '@/features/voice-over/components/generate-button';
import VoiceToneVoicePicker from '@/features/voice-over/components/voice-tone-voice-picker';
import {
  defaultToneGroupForVoiceId,
  deliveryStyleForToneGroup,
  firstVoiceIdInTone,
  voicesForToneGroup,
  type VoiceToneGroupId,
} from '@/lib/voice-over-tone-groups';
import {
  fetchVoiceOverModels,
  voiceOverStart,
  openVoiceOverSse,
  type VoiceModelDescriptor,
} from '@/lib/voice-over-api';
import { normalizeClientErrorMessage } from '@/lib/api-error-message';
import { useVoiceOverEstimate } from '@/lib/use-voice-over-estimate';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';

// TODO: replace with real auth state
const isSignedIn = true;

export default function VoiceOverPage() {
  const t = useTranslations('voice-over');

  const [scriptText, setScriptText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('kore');
  const [voiceToneGroupId, setVoiceToneGroupId] = useState<VoiceToneGroupId>(() =>
    defaultToneGroupForVoiceId('kore'),
  );
  const [voiceModelCatalog, setVoiceModelCatalog] = useState<VoiceModelDescriptor[]>([]);
  const [voiceModelsLoading, setVoiceModelsLoading] = useState(false);
  const [voiceModelsError, setVoiceModelsError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    estimate: voiceOverPointsEstimate,
    loading: estimateLoading,
    error: estimateError,
  } = useVoiceOverEstimate(scriptText, { enabled: scriptText.trim().length > 0 });

  const estimateCost =
    typeof voiceOverPointsEstimate?.reserveCostPoints === 'number' &&
    Number.isFinite(voiceOverPointsEstimate.reserveCostPoints)
      ? voiceOverPointsEstimate.reserveCostPoints
      : null;
  const estimateUnavailable = Boolean(estimateError);

  const isGenerating = useMemo(
    () => isLoading || (progress !== null && progress.percent < 100),
    [isLoading, progress],
  );

  useEffect(() => {
    let cancelled = false;
    setVoiceModelsLoading(true);
    setVoiceModelsError(null);
    void fetchVoiceOverModels()
      .then((data) => {
        if (cancelled) return;
        const gemini = data.providers?.find((p) => String(p.provider).toUpperCase() === 'GEMINI');
        const list = gemini?.models ?? data.providers?.[0]?.models ?? [];
        setVoiceModelCatalog(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setVoiceModelCatalog([]);
          setVoiceModelsError(
            normalizeClientErrorMessage(e instanceof Error ? e.message : String(e)),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setVoiceModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (voiceModelCatalog.length === 0) return;
    const ids = new Set(voiceModelCatalog.map((m) => m.id.toLowerCase()));
    const sel = selectedVoiceId.toLowerCase();

    if (!ids.has(sel)) {
      const pick =
        firstVoiceIdInTone(voiceModelCatalog, voiceToneGroupId) ??
        firstVoiceIdInTone(voiceModelCatalog, 'conversational') ??
        voiceModelCatalog[0]?.id ??
        'kore';
      setSelectedVoiceId(pick);
      setVoiceToneGroupId(defaultToneGroupForVoiceId(pick));
      return;
    }

    const inTone = voicesForToneGroup(voiceModelCatalog, voiceToneGroupId).some(
      (m) => m.id.toLowerCase() === sel,
    );
    if (!inTone) {
      setVoiceToneGroupId(defaultToneGroupForVoiceId(selectedVoiceId));
    }
  }, [voiceModelCatalog, selectedVoiceId, voiceToneGroupId]);

  const handleGenerate = async () => {
    const text = scriptText.trim();
    if (!text) return;
    setIsLoading(true);
    setError(null);
    setAudioSrc('');
    setProgress({ percent: 15, label: t('progress.starting') });
    try {
      const started = await voiceOverStart({
        text,
        aiModel: selectedVoiceId,
        style: deliveryStyleForToneGroup(voiceToneGroupId),
      });

      openVoiceOverSse(started.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setProgress(p);
        },
        onDone: () => {},
        onError: (msg) => {
          setError(normalizeClientErrorMessage(msg));
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
          setError(normalizeClientErrorMessage(payload.message ?? 'Voice over failed'));
          setProgress(null);
        },
      });
    } catch (e) {
      setError(normalizeClientErrorMessage(e instanceof Error ? e.message : String(e)));
      setProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6 sm:py-6">
          <div className="voice-over-shell min-w-0 w-full space-y-10">
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="content-creator-icon-tile">
                    <Mic className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                action={
                  <FeatureHelpButton ariaLabel={t('page.helpAria')} message={t('page.helpMessage')} />
                }
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />

              <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-0">
                {/* Left: script + estimate (wide screens) */}
                <div className="flex min-w-0 flex-col gap-6">
                  <ScriptInput
                    value={scriptText}
                    onChange={setScriptText}
                    kicker={t('scriptInput.kicker')}
                    placeholder={t('scriptInput.placeholder')}
                    exampleHint={t('scriptInput.example')}
                    variant="voiceStudio"
                    showCharacterCount={false}
                    disabled={isGenerating}
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
                      <div className="mt-2 space-y-1">
                        <p className="text-sm leading-relaxed text-red-400">{t('estimate.unavailable')}</p>
                        {estimateError ? (
                          <p className="text-xs leading-relaxed text-red-400">{estimateError}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('estimate.hint')}</p>
                    )}
                  </div>
                </div>

                {/* Right: voice, generate, progress, output (sticky on wide screens) */}
                <div className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t('models.label')}</p>
                    <VoiceToneVoicePicker
                      catalog={voiceModelCatalog}
                      loading={voiceModelsLoading}
                      error={voiceModelsError}
                      toneGroupId={voiceToneGroupId}
                      onToneGroupChange={setVoiceToneGroupId}
                      selectedVoiceId={selectedVoiceId}
                      onVoiceIdChange={setSelectedVoiceId}
                      disabled={isGenerating}
                    />
                  </div>

                  <GenerateButton
                    onClick={handleGenerate}
                    isLoading={isGenerating}
                    disabled={!scriptText.trim()}
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
                      <ProgressBar
                        value={progress.percent}
                        max={100}
                        ariaLabel={progress.label}
                        isComplete={progress.percent >= 100}
                        fillClassName="bg-violet-500"
                      />
                    </div>
                  ) : null}

                  {error ? <p className="text-sm text-red-400">{error}</p> : null}

                  {audioSrc ? (
                    <AudioPlayer src={audioSrc} filename="voice-over.mp3" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
