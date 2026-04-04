'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LoginGate from '@/features/shared/components/LoginGate';
import ScriptInput from '@/features/shared/components/ScriptInput';
import VoiceSelector from '@/features/shared/components/VoiceSelector';
import AudioPlayer from '@/features/shared/components/AudioPlayer';
import GenerateButton from '@/features/ai-voice/components/GenerateButton';
import type { VoiceStyle } from '@/features/shared/types';

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

          {audioSrc && (
            <AudioPlayer src={audioSrc} filename="ai-voice.mp3" />
          )}
        </div>
      )}
    </>
  );
}
