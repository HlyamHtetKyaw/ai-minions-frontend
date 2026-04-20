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
import UploadZone from '@/components/shared/components/upload-zone';
import { fileToDataUrl, openContentGenerationSse, startGenerateContentV2 } from '@/lib/content-generation-api';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';

// TODO: replace with real auth state
const isSignedIn = true;

export default function ContentGenerationPage() {
  const t = useTranslations('contentGeneration');

  const [contentType, setContentType] = useState<ContentTypeKey>('hook');
  const [outputMode, setOutputMode] = useState<OutputModeKey>('imageAndText');
  const [textLength, setTextLength] = useState<'short' | 'long'>('short');
  const [targetLanguage, setTargetLanguage] = useState<'English' | 'Myanmar'>('Myanmar');
  const [tone, setTone] = useState<ToneKey>('inspiring');
  const [toonStyle, setToonStyle] = useState('toon comic style, social media meme layout');
  const [topic, setTopic] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [aiOverlayTextEnabled, setAiOverlayTextEnabled] = useState(false);
  const [userOverlayText, setUserOverlayText] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generatedImageDataUrl, setGeneratedImageDataUrl] = useState('');
  const [storageUrl, setStorageUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isVisualOutput = outputMode === 'imageAndText' || outputMode === 'imageOnly';

  const toUserSafeError = (raw: string): string => {
    const msg = (raw ?? '').trim();
    if (!msg) return 'Content generation failed. Please try again.';
    return msg.length > 180 ? `${msg.slice(0, 180)}...` : msg;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setStatus('');
    setProgress({ percent: 8, label: 'Preparing request...' });
    try {
      const logoDataUrl = logoFile ? await fileToDataUrl(logoFile) : undefined;
      const start = await startGenerateContentV2({
        topic,
        contentType,
        textLength,
        targetLanguage,
        outputMode,
        tone,
        toonStyle,
        logoDataUrl,
        aiOverlayTextEnabled,
        userOverlayText: userOverlayText.trim() || undefined,
      });
      setProgress({ percent: 14, label: 'Job created. Waiting for updates...' });

      await new Promise<void>((resolve) => {
        openContentGenerationSse(start.jobId, {
          onStatus: (raw) => {
            const parsed = parseGenerationSseProgressPayload(raw);
            if (parsed) {
              setProgress(parsed);
            }
          },
          onDone: () => {},
          onError: (msg) => {
            setStatus(toUserSafeError(msg));
            setProgress(null);
            resolve();
          },
          onTerminal: (payload) => {
            if (payload.status === 'completed' && payload.data) {
              const result = payload.data;
              setGeneratedText(result.generatedText || '');
              setStorageUrl(result.storageUrl || '');
              setGeneratedImageDataUrl(result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : '');
              setProgress({ percent: 100, label: 'Finished 🎉' });
              setStatus('');
            } else {
              setStatus(toUserSafeError(payload.message ?? 'Content generation failed.'));
              setProgress(null);
            }
            resolve();
          },
        });
      });
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
              {isVisualOutput ? (
                <UploadZone
                  accept="image/png,image/jpeg"
                  onFileChange={setLogoFile}
                  kicker={t('logoUpload.kicker')}
                  label={t('logoUpload.label')}
                  instructionPrimary={t('logoUpload.instruction')}
                  instructionSecondary={t('logoUpload.formats')}
                />
              ) : null}
              <TopicInput value={topic} onChange={setTopic} />
              {outputMode === 'imageAndText' || outputMode === 'textOnly' ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted">Target language</p>
                  <div className="flex items-center gap-6 rounded-md border border-card-border bg-background px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="targetLanguage"
                        value="Myanmar"
                        checked={targetLanguage === 'Myanmar'}
                        onChange={() => setTargetLanguage('Myanmar')}
                      />
                      Myanmar
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="targetLanguage"
                        value="English"
                        checked={targetLanguage === 'English'}
                        onChange={() => setTargetLanguage('English')}
                      />
                      English
                    </label>
                  </div>
                </div>
              ) : null}
              {isVisualOutput ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted">Toon style</p>
                  <select
                    value={toonStyle}
                    onChange={(e) => setToonStyle(e.target.value)}
                    className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    <option value="toon comic style, social media meme layout">Comic Toon (Default)</option>
                    <option value="anime toon style, bold outlines, vibrant colors">Anime Toon</option>
                    <option value="realistic style, semi-realistic characters, detailed lighting">Realistic</option>
                    <option value="flat vector style, clean shapes, pastel palette">Flat Vector</option>
                    <option value="retro pop-art style, halftone dots, high contrast">Retro Pop Art</option>
                    <option value="cinematic style, dramatic lighting, dynamic composition">Cinematic</option>
                  </select>
                </div>
              ) : null}
              {outputMode === 'imageAndText' || outputMode === 'textOnly' ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted">Generated text length</p>
                  <div className="flex items-center gap-6 rounded-md border border-card-border bg-background px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="generatedTextLength"
                        value="short"
                        checked={textLength === 'short'}
                        onChange={() => setTextLength('short')}
                      />
                      Short
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="generatedTextLength"
                        value="long"
                        checked={textLength === 'long'}
                        onChange={() => setTextLength('long')}
                      />
                      Long
                    </label>
                  </div>
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
                    Show AI overlay text
                  </label>
                  <div className="space-y-1">
                    <p className="text-xs text-muted">User overlay text (optional)</p>
                    <input
                      value={userOverlayText}
                      onChange={(e) => setUserOverlayText(e.target.value)}
                      placeholder="Enter your own overlay text..."
                      className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </div>
                </div>
              ) : null}
              <TonePicker value={tone} onChange={setTone} />
              <GenerateButton topic={topic} isLoading={isLoading} onClick={handleGenerate} />
              {progress ? (
                <div className={`rounded-xl border border-card-border bg-card px-4 py-3 ${progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm ${progress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {progress.label}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {progress.percent}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-subtle">
                    <div
                      className={`h-2 rounded-full transition-[width] ${progress.percent >= 100 ? 'bg-emerald-600' : 'bg-foreground'}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {!progress && status ? (
                <div className="rounded-xl border border-card-border bg-card px-4 py-3">
                  <p className="text-sm text-muted-foreground">{status}</p>
                </div>
              ) : null}
              <ResultPanel text={generatedText} imageDataUrl={generatedImageDataUrl} storageUrl={storageUrl} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
