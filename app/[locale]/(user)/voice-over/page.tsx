'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import VoiceSelector from '@/components/shared/components/voice-selector';
import AudioPlayer from '@/components/shared/components/audio-player';
import type { VoiceStyle } from '@/components/shared/types';
import PageHeader from '@/components/layout/page-header';
import GenerateButton from '@/features/voice-over/components/generate-button';

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

              <GenerateButton
                onClick={handleGenerate}
                isLoading={isLoading}
                disabled={!scriptText.trim()}
              />

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
