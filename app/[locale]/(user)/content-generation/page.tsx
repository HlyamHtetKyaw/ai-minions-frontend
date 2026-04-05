'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleHelp, Sparkles } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import PageHeader from '@/components/layout/page-header';
import ContentTypePicker, { type ContentTypeKey } from '@/features/content-generation/components/content-type-picker';
import OutputModePicker, { type OutputModeKey } from '@/features/content-generation/components/output-mode-picker';
import TopicInput from '@/features/content-generation/components/topic-input';
import TonePicker, { type ToneKey } from '@/features/content-generation/components/tone-picker';
import GenerateButton from '@/features/content-generation/components/generate-button';
import ResultPanel from '@/features/content-generation/components/result-panel';

// TODO: replace with real auth state
const isSignedIn = true;

export default function ContentGenerationPage() {
  const t = useTranslations('contentGeneration');

  const [contentType, setContentType] = useState<ContentTypeKey>('hook');
  const [outputMode, setOutputMode] = useState<OutputModeKey>('imageAndText');
  const [tone, setTone] = useState<ToneKey>('inspiring');
  const [topic, setTopic] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      // TODO: call content generation API with { contentType, outputMode, tone, topic }
      setGeneratedText('');
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
            <div className="content-creator-shell space-y-10">
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="content-creator-icon-tile">
                    <Sparkles className="h-6 w-6" strokeWidth={2.25} />
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

              <ContentTypePicker value={contentType} onChange={setContentType} />
              <OutputModePicker value={outputMode} onChange={setOutputMode} />
              <TopicInput value={topic} onChange={setTopic} />
              <TonePicker value={tone} onChange={setTone} />
              <GenerateButton topic={topic} isLoading={isLoading} onClick={handleGenerate} />
              <ResultPanel text={generatedText} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
