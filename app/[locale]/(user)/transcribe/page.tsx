'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleHelp, Mic } from 'lucide-react';
import LoginGate from '@/features/shared/components/LoginGate';
import UploadZone from '@/features/shared/components/UploadZone';
import TranscribeButton from '@/features/transcribe/components/TranscribeButton';
import TranscriptResult from '@/features/transcribe/components/TranscriptResult';

// TODO: replace with real auth state
const isSignedIn = true;

export default function TranscribePage() {
  const t = useTranslations('transcribe');

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTranscribe = async () => {
    setIsLoading(true);
    try {
      // TODO: call transcription API
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
          {/* Same horizontal rail as Header: mx-auto max-w-7xl + page px-4 sm:px-6 */}
          <div className="mx-auto w-full max-w-7xl">
            <div className="transcribe-shell space-y-8">
              <header className="flex gap-4">
                <div className="transcribe-icon-tile" aria-hidden>
                  <Mic className="h-6 w-6" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {t('page.title')}
                    </h1>
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
                      aria-label={t('page.helpAria')}
                    >
                      <CircleHelp className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-muted">{t('page.subtitle')}</p>
                </div>
              </header>

              <UploadZone
                accept="audio/*,video/*"
                kicker={t('uploadZone.kicker')}
                instructionPrimary={t('uploadZone.instruction')}
                instructionSecondary={t('uploadZone.formats')}
                dropzoneClassName="transcribe-dropzone"
                className="space-y-2"
              />

              <TranscribeButton
                onClick={handleTranscribe}
                isLoading={isLoading}
                disabled={!uploadedFile}
              />

              {transcribedText ? <TranscriptResult text={transcribedText} /> : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
