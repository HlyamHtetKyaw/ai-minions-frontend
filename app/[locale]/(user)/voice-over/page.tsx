'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import VoiceSelector from '@/components/shared/components/voice-selector';
import AudioPlayer from '@/components/shared/components/audio-player';
import type { VoiceStyle } from '@/components/shared/types';
import PageHeader from '@/components/layout/page-header';
import GenerateButton from '@/features/voice-over/components/generate-button';
import { voiceOverEstimatePoints, voiceOverStart, openVoiceOverSse } from '@/lib/voice-over-api';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';
import { openVoiceOverSse, voiceOverPresignRead, voiceOverStart } from '@/lib/voice-over-api';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';

// TODO: replace with real auth state
const isSignedIn = true;

type ProviderChoice = 'auto' | 'gemini' | 'openai';

function toUserSafeError(raw: string): string {
  const msg = (raw ?? '').trim();
  if (!msg) return '';
  return msg.length > 180 ? `${msg.slice(0, 180)}…` : msg;
}

async function resolveVoiceOverPlayableUrl(data: Record<string, unknown>): Promise<string> {
  const audioUrl = typeof data.audioUrl === 'string' ? data.audioUrl.trim() : '';
  const s3Key = typeof data.s3Key === 'string' ? data.s3Key.trim() : '';
  const audioBase64 = typeof data.audioBase64 === 'string' ? data.audioBase64.trim() : '';
  if (audioUrl) return audioUrl;
  if (audioBase64) return `data:audio/mpeg;base64,${audioBase64}`;
  if (s3Key) {
    try {
      return await voiceOverPresignRead(s3Key);
    } catch {
      return '';
    }
  }
  return '';
}

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

  const canGenerate = useMemo(() => scriptText.trim().length > 0 && !isLoading, [scriptText, isLoading]);

  const handleGenerate = async () => {
    const text = scriptText.trim();
    if (!text) return;
    setIsLoading(true);
    setError(null);
    setAudioSrc('');
    setProgress({ percent: 10, label: 'Estimating…' });
    try {
      try {
        const est = await voiceOverEstimatePoints(text);
        setEstimateCost(est.reserveCostPoints ?? null);
      } catch {
        // non-blocking
      }

      setProgress({ percent: 25, label: 'Starting voice over…' });
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
              setProgress({ percent: 100, label: 'Finished' });
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
              />

              <div className="rounded-2xl border border-card-border bg-card px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">Model / Provider</div>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as ProviderChoice)}
                    className="h-9 rounded-md border border-card-border bg-subtle/20 px-2 text-xs text-foreground outline-none focus:border-foreground"
                    disabled={isLoading}
                  >
                    <option value="auto">Auto</option>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>
                {estimateCost != null ? (
                  <p className="mt-2 text-xs text-muted">Estimated cost: {estimateCost} pts</p>
                ) : null}
                {progress ? (
                  <p className="mt-2 text-xs text-muted">
                    {progress.label} {typeof progress.percent === 'number' ? `(${progress.percent}%)` : ''}
                  </p>
                ) : null}
                {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
              </div>

              <GenerateButton
                onClick={handleGenerate}
                isLoading={isLoading}
                disabled={!scriptText.trim()}
              />

              {progress ? (
                <div
                  className={`rounded-xl border border-card-border bg-card px-4 py-3 ${progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`text-sm ${progress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                    >
                      {progress.label}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground tabular-nums">{progress.percent}%</p>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-subtle">
                    <div
                      className={`h-2 rounded-full transition-[width] ${progress.percent >= 100 ? 'bg-emerald-600' : 'bg-foreground'}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {!progress && status ? (
                <div className="rounded-xl border border-red-500/25 bg-card px-4 py-3">
                  <p className="text-sm text-red-300">{status}</p>
                </div>
              ) : null}

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
