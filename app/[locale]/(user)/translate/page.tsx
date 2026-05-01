'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import LanguageSelector from '@/features/translate/components/language-selector';
import TextPanels from '@/features/translate/components/text-panels';
import TranslateButton from '@/features/translate/components/translate-button';
import { LANGUAGES } from '@/lib/constants';
import { AUTH_CHANGED_EVENT, getStoredAccessToken } from '@/lib/auth-token';
import { translateEstimatePoints, translateText, type PointsEstimate } from '@/lib/translate-api';

function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export default function TranslatePage() {
  const t = useTranslations('translation');
  type TranslateTone =
    | 'casual_social_media'
    | 'polite_educational'
    | 'formal_corporate'
    | 'youthful_trendy';

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sourceLang, setSourceLang] = useState(LANGUAGES[0].code);
  const [targetLang, setTargetLang] = useState(LANGUAGES[1].code);
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [tone, setTone] = useState<TranslateTone>('casual_social_media');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<PointsEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  useEffect(() => {
    const resolve = () => setIsSignedIn(Boolean(getStoredAccessToken()));
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
  }, []);

  const toUserSafeError = (raw: string): string => {
    const msg = (raw ?? '').trim();
    if (!msg) return t('errors.generic');
    const lower = msg.toLowerCase();
    if (lower.includes('full authentication is required') || lower.includes('401')) {
      return t('errors.unauthorized');
    }
    if (lower.includes('email verification required') || lower.includes('verification required')) {
      return t('errors.verificationRequired');
    }
    return msg;
  };

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  useEffect(() => {
    const text = sourceText.trim();
    if (!text) {
      setEstimate(null);
      setEstimateError(null);
      setEstimateLoading(false);
      return;
    }
    setEstimateLoading(true);
    setEstimateError(null);
    const tmr = setTimeout(() => {
      translateEstimatePoints(text)
        .then((d) => {
          setEstimate(d);
          setEstimateLoading(false);
        })
        .catch((e) => {
          const raw = e instanceof Error ? e.message : String(e);
          setEstimate(null);
          setEstimateError(toUserSafeError(raw));
          setEstimateLoading(false);
        });
    }, 450);
    return () => clearTimeout(tmr);
  }, [sourceText]);

  const handleTranslate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await translateText({
        text: sourceText.trim(),
        sourceLanguage: languageLabel(sourceLang),
        targetLanguage: languageLabel(targetLang),
        style: tone,
      });
      setTranslatedText(result.translatedText);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(toUserSafeError(raw));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col py-4 sm:py-6">
          <div className="w-full min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>
              <FeatureHelpButton ariaLabel={t('page.helpAria')} message={t('page.helpMessage')} />
            </div>

            <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
              <div className="min-w-0 flex-[1_1_0%]">
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-glass-border bg-glass/80 text-muted backdrop-blur-sm transition-colors hover:bg-glass hover:text-foreground sm:h-10 sm:w-10"
                aria-label={t('swapAria')}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-[1_1_0%]">
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
              rows={5}
            />

            <div className="max-w-sm">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Translate style
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as TranslateTone)}
                className="box-border block h-10 w-full rounded-lg border border-glass-border bg-glass/80 px-3 pr-9 text-sm text-foreground outline-none backdrop-blur-sm focus:border-foreground"
              >
                <option value="casual_social_media">Casual / Social Media (spoken)</option>
                <option value="polite_educational">Polite & Educational (spoken)</option>
                <option value="formal_corporate">Formal / Corporate (literary)</option>
                <option value="youthful_trendy">Youthful / Trendy (Gen Z)</option>
              </select>
            </div>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            {estimateLoading || estimate || estimateError ? (
              <div
                className={`rounded-xl border border-glass-border bg-glass/60 px-4 py-3 text-sm backdrop-blur-sm ${
                  estimateError ? 'text-red-400' : 'text-muted'
                }`}
              >
                {estimateLoading
                  ? 'Estimating points…'
                  : estimate
                    ? `Estimated cost: ~${estimate.reserveCostPoints} points`
                    : estimateError
                      ? `Estimate unavailable: ${estimateError}`
                      : null}
              </div>
            ) : null}

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
