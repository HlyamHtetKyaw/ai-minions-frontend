'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import VoiceSelector from '@/components/shared/components/voice-selector';
import AudioPlayer from '@/components/shared/components/audio-player';
import GenerateButton from '@/features/ai-voice/components/generate-button';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import type { VoiceStyle } from '@/components/shared/types';

// TODO: replace with real auth state
const isSignedIn = true;

export default function AiVoicePage() {
  const t = useTranslations('ai-voice');

  const [scriptText, setScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle | ''>('');
  const [audioSrc, setAudioSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    // TODO: call voice generation API
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>
            <FeatureHelpButton ariaLabel={t('page.helpAria')} message={t('page.helpMessage')} />
          </div>

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

          {audioSrc && (
            <AudioPlayer src={audioSrc} filename="ai-voice.mp3" />
          )}
        </div>
      )}
    </>
  );
}
