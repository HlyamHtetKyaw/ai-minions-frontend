'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleHelp, Mic } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import TranscribeButton from '@/features/transcribe/components/transcribe-button';
import TranscriptResult from '@/features/transcribe/components/transcript-result';

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
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="transcribe-icon-tile">
                    <Mic className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                action={
                  <PageHeader.IconButton aria-label={t('page.helpAria')}>
                    <CircleHelp className="h-5 w-5" />
                  </PageHeader.IconButton>
                }
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />

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
