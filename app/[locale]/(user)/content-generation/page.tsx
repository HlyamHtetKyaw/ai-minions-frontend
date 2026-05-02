'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Sparkles } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import PageHeader from '@/components/layout/page-header';
import ProgressBar from '@/components/shared/components/progress-bar';
import ContentTypePicker, { type ContentTypeKey } from '@/features/content-generation/components/content-type-picker';
import OutputModePicker, { type OutputModeKey } from '@/features/content-generation/components/output-mode-picker';
import TopicInput from '@/features/content-generation/components/topic-input';
import TonePicker, { type ToneKey } from '@/features/content-generation/components/tone-picker';
import GenerateButton from '@/features/content-generation/components/generate-button';
import FacebookPreview from '@/features/content-generation/components/FacebookPreview';
import { DEFAULT_TOON_STYLE, TOON_STYLE_OPTIONS } from '@/features/content-generation/content-toon-styles';
import UploadZone from '@/components/shared/components/upload-zone';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import {
  contentGenerationEstimatePoints,
  normalizeContentGenerateV2Result,
  openContentGenerationSse,
  prepareContentLogoUploadUrl,
  startGenerateContentV2,
  uploadContentLogoToSignedUrl,
  type ContentGenerateV2Params,
  type PointsEstimate,
} from '@/lib/content-generation-api';
import { normalizeClientErrorMessage } from '@/lib/api-error-message';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';

function isEstimateNotFoundError(message: string): boolean {
  const m = (message ?? '').toLowerCase();
  return m.includes('404') || /\bnot found\b/.test(m);
}

async function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// TODO: replace with real auth state
const isSignedIn = true;

export default function ContentGenerationPage() {
  
  const t = useTranslations('contentGeneration');

  const toUserSafeError = useCallback((raw: string): string => normalizeClientErrorMessage(raw), []);

  const [contentType, setContentType] = useState<ContentTypeKey>('hook');
  const [outputMode, setOutputMode] = useState<OutputModeKey>('imageAndText');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const [textLength, setTextLength] = useState<'short' | 'long'>('short');
  const [targetLanguage, setTargetLanguage] = useState<'English' | 'Myanmar'>('Myanmar');
  const [tone, setTone] = useState<ToneKey>('inspiring');
  const [toonStyle, setToonStyle] = useState(DEFAULT_TOON_STYLE);
  const [topic, setTopic] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [aiOverlayTextEnabled, setAiOverlayTextEnabled] = useState(false);
  const [userOverlayText, setUserOverlayText] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generatedImageDataUrl, setGeneratedImageDataUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [estimate, setEstimate] = useState<PointsEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const scriptCopyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisualOutput = outputMode === 'imageAndText' || outputMode === 'imageOnly';

  /** Image-only mode drops all body text server-side — unusable for scripts. */
  useEffect(() => {
    if (contentType === 'script' && outputMode === 'imageOnly') {
      setOutputMode('textOnly');
    }
  }, [contentType, outputMode]);

  /** Same payload shape as generate/start — server uses topic + textLength + outputMode for points. */
  const contentEstimateParams = useMemo((): ContentGenerateV2Params | null => {
    const t0 = topic.trim();
    if (!t0) return null;
    return {
      topic: t0,
      contentType,
      textLength,
      targetLanguage,
      outputMode,
      tone,
      toonStyle,
      aiOverlayTextEnabled,
      userOverlayText: userOverlayText.trim() || undefined,
    };
  }, [topic, contentType, textLength, targetLanguage, outputMode, tone, toonStyle, aiOverlayTextEnabled, userOverlayText]);

  useEffect(() => {
    setScriptCopied(false);
  }, [generatedText]);

  useEffect(() => {
    return () => {
      if (scriptCopyResetRef.current) clearTimeout(scriptCopyResetRef.current);
    };
  }, []);

  useEffect(() => {
    if (!contentEstimateParams) {
      setEstimate(null);
      setEstimateError(null);
      setEstimateLoading(false);
      return;
    }
    setEstimateLoading(true);
    setEstimateError(null);
    let cancelled = false;
    const tmr = setTimeout(() => {
      void (async () => {
        try {
          const d = await withTimeout(
            contentGenerationEstimatePoints(contentEstimateParams),
            12000,
            t('timeouts.estimate'),
          );
          if (!cancelled) {
            setEstimate(d);
            setEstimateLoading(false);
          }
        } catch (e) {
          if (cancelled) return;
          const raw = e instanceof Error ? e.message : String(e);
          setEstimate(null);
          setEstimateError(toUserSafeError(raw));
          setEstimateLoading(false);
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [contentEstimateParams, t, toUserSafeError]);

  const contentSseProgressOverrides = useMemo(
    () => ({
      subscribedLabel: t('sse.subscribed'),
      /** First SSE hello sits lower so the bar can ramp when the stream has no intermediate stages. */
      subscribedPercent: 22,
    }),
    [t],
  );

  const generationRunRef = useRef(0);
  const progressSimTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseProgressFloorRef = useRef(0);

  const clearProgressSimulator = () => {
    if (progressSimTickRef.current != null) {
      clearInterval(progressSimTickRef.current);
      progressSimTickRef.current = null;
    }
  };

  const handleGenerate = async () => {
    if (logoError && outputMode !== 'imageOnly'){
      setStatus(t('errors.fixLogoBeforeGenerating') || 'Please fix the logo upload issue before generating content.');
      return;
    }
    if (isLogoUploading) {
      setStatus(t('errors.fixLogoBeforeGenerating') || 'Please wait for logo upload to complete before generating content.');
      return;
    }

    const runId = ++generationRunRef.current;
    clearProgressSimulator();
  
    setIsLoading(true);
    setStatus('');
    setProgress({ percent: 8, label: t('progress.preparing') });
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        setIsLogoUploading(true);
        const signed = await withTimeout(
          prepareContentLogoUploadUrl(logoFile.name, logoFile.type || 'image/png'),
          20000,
          t('timeouts.prepareUpload'),
        );
        await withTimeout(uploadContentLogoToSignedUrl(signed.uploadUrl, logoFile), 120000, t('timeouts.upload'));
        logoUrl = signed.storageUrl;
      }
      const start = await startGenerateContentV2({
        topic,
        contentType,
        textLength,
        targetLanguage,
        outputMode,
        tone,
        toonStyle,
        logoUrl,
        aiOverlayTextEnabled,
        userOverlayText: userOverlayText.trim() || undefined,
      });
      setProgress({ percent: 14, label: t('progress.jobCreated') });
      sseProgressFloorRef.current = 14;

      await new Promise<void>((resolve) => {
        progressSimTickRef.current = setInterval(() => {
          if (generationRunRef.current !== runId) {
            clearProgressSimulator();
            return;
          }
          setProgress((prev) => {
            if (!prev) return prev;
            const floor = Math.min(sseProgressFloorRef.current, 94);
            const next = Math.min(95, Math.max(prev.percent + 1, floor));
            if (next <= prev.percent) return prev;
            const useSimulatedCopy = prev.percent >= floor + 8;
            return {
              percent: next,
              label: useSimulatedCopy ? t('progress.simulated') : prev.label,
            };
          });
        }, 420);

        openContentGenerationSse(start.jobId, {
          onStatus: (raw) => {
            if (generationRunRef.current !== runId) return;
            const parsed = parseGenerationSseProgressPayload(raw, contentSseProgressOverrides);
            if (parsed) {
              if (parsed.percent >= 100) {
                clearProgressSimulator();
              }
              sseProgressFloorRef.current = Math.max(
                sseProgressFloorRef.current,
                parsed.percent >= 100 ? parsed.percent : Math.min(parsed.percent, 99),
              );
              setProgress((prev) => ({
                percent: Math.max(parsed.percent, prev?.percent ?? 0),
                label: parsed.label,
              }));
            }
          },
          onDone: () => {},
          onError: (msg) => {
            if (generationRunRef.current !== runId) return;
            clearProgressSimulator();
            setStatus(toUserSafeError(msg));
            setProgress(null);
            resolve();
          },
          onTerminal: (payload) => {
            if (generationRunRef.current !== runId) return;
            clearProgressSimulator();
            if (payload.status === 'completed' && payload.data) {
              const result = normalizeContentGenerateV2Result(payload.data);
              const body = (result.generatedText || '').trim();
              const titleLine = (result.shortTextOnImage || '').trim();
              setGeneratedText(body || (contentType === 'script' ? titleLine : ''));
              setGeneratedImageDataUrl(result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : '');
              setProgress({ percent: 100, label: t('progress.finished') });
              setStatus('');
            } else {
              setStatus(toUserSafeError(payload.message ?? 'Content generation failed.'));
              setProgress(null);
            }
            resolve();
          },
        });
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (logoFile) {
        setLogoError(toUserSafeError(raw));
      }
      setStatus(toUserSafeError(raw));
      setProgress(null);
    } finally {
      clearProgressSimulator();
      setIsLogoUploading(false);
      setIsLoading(false);
    }
  };

  const handleLogoChange = useCallback((file: File | null) => {
    setLogoError(null);

    if (!file) {
      setLogoFile(null);
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      setLogoError(t('errors.invalidFormat') || 'Invalid format: Only PNG and JPG are allowed.');
      setLogoFile(null);
      setUploadZoneKey((k) => k + 1);
      return;
    }

    if (file.size > MAX_SIZE) {
      setLogoError(t('errors.fileTooLarge') || 'File size is too large. Maximum size is 5 MB.');
      setLogoFile(null);
      setUploadZoneKey((k) => k + 1);
      return;
    }

    setLogoFile(file);
  }, [t]);


  const handleCopyScript = useCallback(async () => {
    if (!generatedText.trim()) return;
    try {
      await navigator.clipboard.writeText(generatedText);
      setScriptCopied(true);
      if (scriptCopyResetRef.current) clearTimeout(scriptCopyResetRef.current);
      scriptCopyResetRef.current = setTimeout(() => {
        setScriptCopied(false);
        scriptCopyResetRef.current = null;
      }, 2500);
    } catch {
      setScriptCopied(false);
    }
  }, [generatedText]);

  const showScriptResultPanel =
    contentType === 'script' && (generatedText.trim().length > 0 || generatedImageDataUrl.length > 0);
  const showFacebookPreview = !showScriptResultPanel && (generatedText || generatedImageDataUrl);

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6 sm:py-6">
          <div className="content-creator-shell w-full min-w-0">
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="content-creator-icon-tile">
                    <Sparkles className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                action={
                  <FeatureHelpButton ariaLabel={t('page.helpAria')} message={t('page.helpMessage')} />
                }
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />

              <div className="mt-8 flex flex-col gap-10 lg:mt-10 lg:flex-row lg:items-start lg:gap-8 xl:gap-10">
                <div className="min-w-0 flex-1 space-y-8">
              <ContentTypePicker value={contentType} onChange={setContentType} />
              <OutputModePicker value={outputMode} onChange={setOutputMode} />
              {outputMode === 'imageOnly' ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{t('imageOnlyContextHint')}</p>
              ) : null}
              {isVisualOutput ? (
              <UploadZone
                key={uploadZoneKey}
                accept="image/png,image/jpeg"
                onFileChange={handleLogoChange}
                kicker={t('logoUpload.kicker')}
                label={t('logoUpload.label')}
                instructionPrimary={t('logoUpload.instruction')}
                instructionSecondary={t('logoUpload.formats')}
              />
              ) : null}
              {isVisualOutput && logoError ? (
                <p className="text-xs text-red-400">{logoError}</p>
              ) : null}
              <TopicInput value={topic} onChange={setTopic} />
              {outputMode === 'imageAndText' || outputMode === 'textOnly' ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted">{t('targetLanguage.label')}</p>
                  <div className="flex items-center gap-6 rounded-md border border-card-border bg-background px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="targetLanguage"
                        value="Myanmar"
                        checked={targetLanguage === 'Myanmar'}
                        onChange={() => setTargetLanguage('Myanmar')}
                      />
                      {t('targetLanguage.myanmar')}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="targetLanguage"
                        value="English"
                        checked={targetLanguage === 'English'}
                        onChange={() => setTargetLanguage('English')}
                      />
                      {t('targetLanguage.english')}
                    </label>
                  </div>
                </div>
              ) : null}
              {outputMode === 'imageAndText' || outputMode === 'textOnly' ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    {contentType === 'hook'
                      ? t('textLength.hookSectionTitle')
                      : contentType === 'caption'
                        ? t('textLength.captionSectionTitle')
                        : contentType === 'hashtags'
                          ? t('textLength.hashtagsSectionTitle')
                          : contentType === 'script'
                            ? t('textLength.scriptSectionTitle')
                            : t('textLength.genericSectionTitle')}
                  </p>
                  <div className="flex flex-wrap items-center gap-6 rounded-md border border-card-border bg-background px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="generatedTextLength"
                        value="short"
                        checked={textLength === 'short'}
                        onChange={() => setTextLength('short')}
                      />
                      {t('textLength.short')}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="generatedTextLength"
                        value="long"
                        checked={textLength === 'long'}
                        onChange={() => setTextLength('long')}
                      />
                      {t('textLength.long')}
                    </label>
                  </div>
                  {contentType === 'hook' ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {textLength === 'short' ? t('textLength.hookShortHelp') : t('textLength.hookLongHelp')}
                    </p>
                  ) : null}
                  {contentType === 'caption' ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {textLength === 'short' ? t('textLength.captionShortHelp') : t('textLength.captionLongHelp')}
                    </p>
                  ) : null}
                  {contentType === 'hashtags' ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {textLength === 'short' ? t('textLength.hashtagsShortHelp') : t('textLength.hashtagsLongHelp')}
                    </p>
                  ) : null}
                  {contentType === 'script' ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {textLength === 'short' ? t('textLength.scriptShortHelp') : t('textLength.scriptLongHelp')}
                    </p>
                  ) : null}
                </div>
              ) : null}
                </div>

                <aside className="content-creator-output-aside w-full shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[min(100%,440px)] lg:overflow-y-auto lg:self-start xl:w-[min(100%,500px)]">
                  <div className="space-y-6 lg:rounded-2xl lg:border lg:border-card-border lg:bg-card/25 lg:p-4 xl:p-5">
                    <div className="space-y-6">
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        {t('layout.styleAndActionsHeading')}
                      </h2>
                      {isVisualOutput ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted">{t('toonStyle.label')}</p>
                          <select
                            value={toonStyle}
                            onChange={(e) => setToonStyle(e.target.value)}
                            className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                          >
                            {TOON_STYLE_OPTIONS.map((o) => (
                              <option key={o.label} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      {isVisualOutput ? (
                        <div className="space-y-3 rounded-xl border border-card-border bg-card/30 p-4">
                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={aiOverlayTextEnabled}
                              onChange={(e) => setAiOverlayTextEnabled(e.target.checked)}
                            />
                            {t('overlay.showAiText')}
                          </label>
                          <div className="space-y-1">
                            <p className="text-xs text-muted">{t('overlay.userTextOptional')}</p>
                            <input
                              value={userOverlayText}
                              onChange={(e) => setUserOverlayText(e.target.value)}
                              placeholder={t('overlay.userTextPlaceholder')}
                              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                            />
                          </div>
                        </div>
                      ) : null}
                      <TonePicker value={tone} onChange={setTone} />
                      <div className="rounded-xl border border-card-border bg-card px-4 py-3">
                        <p className={`text-sm ${estimateError ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {estimateLoading
                            ? t('estimate.loading')
                            : estimate
                              ? t('estimate.cost', { points: estimate.reserveCostPoints })
                              : estimateError
                                ? isEstimateNotFoundError(estimateError)
                                  ? t('estimate.backendMissing')
                                  : t('estimate.unavailable', { message: estimateError })
                                : t('estimate.prompt')}
                        </p>
                      </div>
                      <GenerateButton
                        topic={topic}
                        isLoading={isLoading}
                        disabled={isLogoUploading}
                        onClick={handleGenerate}
                      />
                      {progress ? (
                        <div
                          className={`rounded-xl border border-card-border bg-card px-4 py-3 ${progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p
                              className={`text-sm ${progress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                            >
                              {progress.label}
                            </p>
                            <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                              {progress.percent}%
                            </p>
                          </div>
                          <ProgressBar
                            value={progress.percent}
                            max={100}
                            ariaLabel={progress.label}
                            isComplete={progress.percent >= 100}
                          />
                        </div>
                      ) : null}
                      {!progress && status ? (
                        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
                          <p className="text-sm text-red-400">{status}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-card-border pt-6">
                      <h2 className="mb-4 text-sm font-semibold tracking-tight text-foreground">
                        {t('layout.outputHeading')}
                      </h2>
                    {showScriptResultPanel ? (
                      <div className="w-full space-y-4">
                        {generatedText.trim() ? (
                          <div className="overflow-hidden rounded-xl border border-card-border bg-card">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border bg-card/50 px-4 py-2">
                              <p className="text-sm font-medium text-foreground">{t('result.scriptOutputTitle')}</p>
                              <button
                                type="button"
                                onClick={() => void handleCopyScript()}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-card-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-subtle"
                                aria-label={t('result.copyScriptAria')}
                              >
                                {scriptCopied ? (
                                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                {scriptCopied ? t('result.copied') : t('result.copy')}
                              </button>
                            </div>
                            <pre className="max-h-[min(70vh,48rem)] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-sans text-sm leading-relaxed text-foreground lg:max-h-[min(60vh,36rem)]">
                              {generatedText}
                            </pre>
                          </div>
                        ) : null}
                        {generatedImageDataUrl && outputMode !== 'textOnly' ? (
                          <div className="overflow-hidden rounded-xl border border-card-border bg-card">
                            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from generation API */}
                            <img
                              src={generatedImageDataUrl}
                              alt={t('result.title')}
                              className="mx-auto max-h-[min(50vh,520px)] w-full object-contain lg:max-h-[min(45vh,400px)]"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {showFacebookPreview ? (
                      <FacebookPreview
                        contentType={outputMode as 'imageAndText' | 'textOnly' | 'imageOnly'}
                        imageUrl={generatedImageDataUrl || null}
                        textContent={generatedText}
                        onDownload={() => {
                          if (!generatedImageDataUrl) return;
                          const byteCharacters = atob(generatedImageDataUrl.split(',')[1]);
                          const byteNumbers = new Array(byteCharacters.length);
                          for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                          }
                          const byteArray = new Uint8Array(byteNumbers);
                          const blob = new Blob([byteArray], { type: 'image/png' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `ai-minions-content-${Date.now()}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                      />
                    ) : null}
                    {!showScriptResultPanel && !showFacebookPreview && isLoading ? (
                      <div
                        className="flex min-h-[8rem] items-center justify-center rounded-xl border border-dashed border-card-border bg-card/40 px-4 py-8 text-center"
                        aria-live="polite"
                      >
                        <p className="text-sm text-muted-foreground">{t('layout.outputWorking')}</p>
                      </div>
                    ) : null}
                    {!showScriptResultPanel && !showFacebookPreview && !isLoading ? (
                      <div className="hidden min-h-[6rem] items-center justify-center rounded-xl border border-dashed border-card-border bg-card/20 px-4 py-8 text-center lg:flex">
                        <p className="text-sm text-muted-foreground">{t('layout.outputEmpty')}</p>
                      </div>
                    ) : null}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
