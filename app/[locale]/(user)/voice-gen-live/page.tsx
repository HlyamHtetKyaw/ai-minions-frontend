'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LoginGate from '@/components/shared/components/login-gate';
import ScriptInput from '@/components/shared/components/script-input';
import VoiceSelector from '@/components/shared/components/voice-selector';
import LivePlayer from '@/features/voice-gen-live/components/live-player';
import StartButton from '@/features/voice-gen-live/components/start-button';
import type { VoiceStyle } from '@/components/shared/types';

// TODO: replace with real auth state
const isSignedIn = true;

export default function VoiceGenLivePage() {
  const t = useTranslations('voice-gen-live');

  const [scriptText, setScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle | ''>('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleStart = () => {
    setSentences(scriptText.split('.').filter(Boolean));
    // TODO: begin sequential sentence playback
  };

  const canStart = scriptText.trim().length > 0 && !isPlaying;

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
            disabled={isPlaying}
          />

          <VoiceSelector value={selectedVoice} onChange={setSelectedVoice} />

          <StartButton
            onClick={handleStart}
            isLoading={isPlaying}
            disabled={!canStart}
          />

          {sentences.length > 0 && (
            <LivePlayer sentences={sentences} currentIndex={currentIndex} />
          )}
        </div>
      )}
    </>
  );
}
