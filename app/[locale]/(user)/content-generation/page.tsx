'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import {
  CircleHelp,
  FileText,
  Hash,
  Image as ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Tag,
  Type,
} from 'lucide-react';
import LoginGate from '@/features/shared/components/LoginGate';

// TODO: replace with real auth state
const isSignedIn = true;

const CONTENT_TYPE_KEYS = ['hook', 'caption', 'script', 'hashtags'] as const;
type ContentTypeKey = (typeof CONTENT_TYPE_KEYS)[number];

const CONTENT_TYPE_ICONS: Record<ContentTypeKey, LucideIcon> = {
  hook: Hash,
  caption: FileText,
  script: Type,
  hashtags: Tag,
};

const TONE_KEYS = [
  'engaging',
  'professional',
  'casual',
  'funny',
  'inspiring',
  'dramatic',
] as const;
type ToneKey = (typeof TONE_KEYS)[number];

const OUTPUT_MODE_KEYS = ['imageAndText', 'textOnly', 'imageOnly'] as const;
type OutputModeKey = (typeof OUTPUT_MODE_KEYS)[number];

const OUTPUT_MODE_ICONS: Record<OutputModeKey, LucideIcon> = {
  imageAndText: Layers,
  textOnly: FileText,
  imageOnly: ImageIcon,
};

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
              <header className="flex gap-4">
                <div className="content-creator-icon-tile" aria-hidden>
                  <Sparkles className="h-6 w-6" strokeWidth={2.25} />
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

              <section className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {t('contentTypeLabel')}
                </p>
                <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0 sm:overflow-visible sm:pb-0">
                  <div
                    className="content-type-row min-w-[520px] sm:min-w-0"
                    role="tablist"
                    aria-label={t('contentTypeLabel')}
                  >
                  {CONTENT_TYPE_KEYS.map((key) => {
                    const Icon = CONTENT_TYPE_ICONS[key];
                    const active = contentType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setContentType(key)}
                        className={`content-type-grid-btn ${active ? 'content-type-grid-btn-active' : ''}`}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${active ? 'text-fuchsia-400' : 'text-muted'}`}
                          strokeWidth={active ? 2.25 : 2}
                          aria-hidden
                        />
                        <span className="leading-tight">{t(`contentTypes.${key}`)}</span>
                        {active ? (
                          <span className="content-type-hint">{t(`contentTypeHints.${key}`)}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {t('outputModeLabel')}
                </p>
                <div
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                  role="group"
                  aria-label={t('outputModeLabel')}
                >
                  {OUTPUT_MODE_KEYS.map((key) => {
                    const Icon = OUTPUT_MODE_ICONS[key];
                    const selected = outputMode === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setOutputMode(key)}
                        aria-pressed={selected}
                        className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-3.5 text-left transition sm:min-h-22 ${
                          selected
                            ? 'border-fuchsia-500/70 bg-fuchsia-500/10 shadow-[0_0_0_1px_rgba(232,121,249,0.35)]'
                            : 'border-card-border bg-subtle/60 hover:border-fuchsia-500/35'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 ${selected ? 'text-fuchsia-400' : 'text-muted'}`}
                          strokeWidth={2.25}
                          aria-hidden
                        />
                        <span className="text-sm font-semibold text-foreground">
                          {t(`outputModes.${key}`)}
                        </span>
                        <span className="text-xs leading-snug text-muted">
                          {t(`outputModeHints.${key}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <label
                  htmlFor="content-topic"
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
                >
                  {t('topicLabel')}
                </label>
                <textarea
                  id="content-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                  className="textarea-content-creator"
                  rows={6}
                />
              </section>

              <section className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {t('toneLabel')}
                </p>
                <div
                  className="flex flex-wrap items-center gap-2 sm:gap-2.5"
                  role="group"
                  aria-label={t('toneLabel')}
                >
                  {TONE_KEYS.map((key) => {
                    const selected = tone === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTone(key)}
                        aria-pressed={selected}
                        className={`tone-chip ${selected ? 'tone-chip-active' : ''}`}
                      >
                        {t(`tones.${key}`)}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="flex justify-start pt-1">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!topic.trim() || isLoading}
                  className="btn-content-generate w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  )}
                  {isLoading ? t('generateButton.loading') : t('generateButton.label')}
                </button>
              </div>

              {generatedText ? (
                <div className="content-creator-result-panel p-4">
                  <p className="text-sm font-semibold text-foreground">{t('result.title')}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {generatedText}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
