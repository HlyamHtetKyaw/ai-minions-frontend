'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, CircleHelp, Languages } from 'lucide-react';
import LoginGate from '@/features/shared/components/LoginGate';
import LanguageSelector from '@/features/translate/components/LanguageSelector';
import TranslateButton from '@/features/translate/components/TranslateButton';
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
            <header className="flex gap-4">
              <div className="transcribe-icon-tile" aria-hidden>
                <Languages className="h-6 w-6" strokeWidth={2.25} />
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

            <div className="flex items-end gap-3">
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
                className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-card-border bg-surface text-muted transition-colors hover:bg-surface hover:text-foreground"
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('sourceText')}</label>
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder={t('sourcePlaceholder')}
                  rows={8}
                  className="resize-none rounded-xl border border-card-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('translatedText')}</label>
                <textarea
                  value={translatedText}
                  readOnly
                  placeholder={t('translatedPlaceholder')}
                  rows={8}
                  className="resize-none rounded-xl border border-card-border bg-subtle px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
                />
              </div>
            </div>

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
