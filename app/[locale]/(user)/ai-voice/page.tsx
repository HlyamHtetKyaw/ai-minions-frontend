'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import VoiceSelector from '@/components/shared/components/voice-selector';
import AudioPlayer from '@/components/shared/components/audio-player';
import GenerateButton from '@/features/ai-voice/components/generate-button';
import type { VoiceStyle } from '@/components/shared/types';
import { openVoiceOverSse, startGenerateVoiceOver } from '@/lib/voice-over-api';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';

// TODO: replace with real auth state
const isSignedIn = true;

export default function AiVoicePage() {
  const t = useTranslations('ai-voice');

  const [scriptText, setScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle | ''>('');
  const [audioSrc, setAudioSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setStatus('');
    setProgress({ percent: 8, label: 'Preparing request...' });
    try {
      const start = await startGenerateVoiceOver({
        text: scriptText,
        aiModel: selectedVoice || undefined,
      });

      await new Promise<void>((resolve) => {
        openVoiceOverSse(start.jobId, {
          onStatus: (raw) => {
            const parsed = parseGenerationSseProgressPayload(raw);
            if (parsed) {
              setProgress(parsed);
            }
          },
          onDone: () => {},
          onError: (msg) => {
            setStatus(msg || 'Voice over generation failed.');
            setProgress(null);
            resolve();
          },
          onTerminal: (payload) => {
            if (payload.status === 'completed' && payload.data) {
              const result = payload.data;
              const fallbackSrc = result.audioBase64
                ? `data:audio/mpeg;base64,${result.audioBase64}`
                : '';
              const usableStorageUrl = /^https?:\/\//i.test(result.audioUrl) ? result.audioUrl : '';
              setAudioSrc(usableStorageUrl || fallbackSrc);
              setProgress({ percent: 100, label: 'Finished 🎉' });
              setStatus('');
            } else {
              setStatus(payload.message ?? 'Voice over generation failed.');
              setProgress(null);
            }
            resolve();
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate voice over.';
      setStatus(message);
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
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>

          <ScriptInput
            value={scriptText}
            onChange={setScriptText}
            placeholder={t('scriptInput.placeholder')}
            disabled={isLoading}
          />

          <VoiceSelector value={selectedVoice} onChange={setSelectedVoice} />

          <GenerateButton
            onClick={handleGenerate}
            isLoading={isLoading}
            disabled={!scriptText.trim()}
          />

          {progress ? (
            <div className={`rounded-xl border border-card-border bg-card px-4 py-3 ${progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm ${progress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {progress.label}
                </p>
                <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {progress.percent}%
                </p>
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
            <div className="rounded-xl border border-card-border bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          ) : null}

          {audioSrc && (
            <AudioPlayer src={audioSrc} filename="ai-voice.mp3" />
          )}
        </div>
      )}
    </>
  );
}
