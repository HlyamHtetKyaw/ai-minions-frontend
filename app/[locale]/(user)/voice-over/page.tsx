'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Mic } from 'lucide-react';
import LoginGate from '@/features/shared/components/LoginGate';
import ScriptInput from '@/features/shared/components/ScriptInput';
import VoiceSelector from '@/features/shared/components/VoiceSelector';
import AudioPlayer from '@/features/shared/components/AudioPlayer';
import type { VoiceStyle } from '@/features/shared/types';

// TODO: replace with real auth state
const isSignedIn = true;

export default function VoiceOverPage() {
  const t = useTranslations('voice-over');

  const [scriptText, setScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle>('woman');
  const [audioSrc, setAudioSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      // TODO: call voice-over generation API
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
              <header className="flex gap-4">
                <div className="content-creator-icon-tile" aria-hidden>
                  <Mic className="h-6 w-6" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {t('page.title')}
                  </h1>
                  <p className="mt-1 text-sm text-muted">{t('page.subtitle')}</p>
                </div>
              </header>

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

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!scriptText.trim() || isLoading}
                className="btn-voice-generate"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                )}
                {isLoading ? t('generateButton.loading') : t('generateButton.label')}
              </button>

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
