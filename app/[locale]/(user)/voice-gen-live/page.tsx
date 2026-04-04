'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LoginGate from '@/features/shared/components/LoginGate';
import ScriptInput from '@/features/shared/components/ScriptInput';
import VoiceSelector from '@/features/shared/components/VoiceSelector';
import LivePlayer from '@/features/voice-gen-live/components/LivePlayer';
import type { VoiceStyle } from '@/features/shared/types';

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

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPlaying ? t('startButton.playing') : t('startButton.label')}
          </button>

          {sentences.length > 0 && (
            <LivePlayer sentences={sentences} currentIndex={currentIndex} />
          )}
        </div>
      )}
    </>
  );
}
