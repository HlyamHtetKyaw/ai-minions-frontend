'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, CircleHelp, Languages } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import PageHeader from '@/components/layout/page-header';
import LanguageSelector from '@/features/translate/components/language-selector';
import TextPanels from '@/features/translate/components/text-panels';
import TranslateButton from '@/features/translate/components/translate-button';
import { LANGUAGES } from '@/lib/constants';

// TODO: replace with real auth state
const isSignedIn = true;

export default function TranslatePage() {
  const t = useTranslations('translation');

  const [sourceLang, setSourceLang] = useState(LANGUAGES[0].code);
  const [targetLang, setTargetLang] = useState(LANGUAGES[1].code);
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleTranslate = async () => {
    setIsLoading(true);
    try {
      // TODO: call translation API
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
          <div className="mx-auto w-full max-w-7xl space-y-8">
            <PageHeader
              icon={
                <PageHeader.Icon tileClassName="transcribe-icon-tile">
                  <Languages className="h-6 w-6" strokeWidth={2.25} />
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

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <LanguageSelector
                  label={t('sourceLanguage')}
                  value={sourceLang}
                  options={LANGUAGES}
                  onChange={setSourceLang}
                />
              </div>
              <button
                type="button"
                onClick={handleSwap}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-glass-border bg-glass/80 text-muted backdrop-blur-sm transition-colors hover:bg-glass hover:text-foreground"
                aria-label={t('swapAria')}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <LanguageSelector
                  label={t('targetLanguage')}
                  value={targetLang}
                  options={LANGUAGES}
                  onChange={setTargetLang}
                />
              </div>
            </div>

            <TextPanels
              sourceLabel={t('sourceText')}
              sourceValue={sourceText}
              sourcePlaceholder={t('sourcePlaceholder')}
              onSourceChange={setSourceText}
              translatedLabel={t('translatedText')}
              translatedValue={translatedText}
              translatedPlaceholder={t('translatedPlaceholder')}
            />

            <TranslateButton
              onClick={handleTranslate}
              isLoading={isLoading}
              disabled={!sourceText.trim()}
            />
          </div>
        </div>
      )}
    </>
  );
}
