'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Film, Loader2, Upload } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import ActionButton from '@/components/shared/components/action-button';
import CreationStudio from '@/components/viralShorts/CreationStudio';
import { AUTH_CHANGED_EVENT, getStoredAccessToken } from '@/lib/auth-token';
import { uploadFileToPresignedUrl, videoEditorPrepareUploadUrl } from '@/lib/video-editor-api';
import { viralShortsClearWorkspace, viralShortsGetWorkspace, viralShortsSaveSnapshot } from '@/lib/viral-shorts-workspace-api';
import { parseViralWorkspacePayloadForRestore } from '@/lib/viral-workspace-persistence';
import { normalizePersistedVoiceId } from '@/lib/voice-over-api';

type PageStep = 'upload' | 'uploading' | 'preparing_workspace' | 'studio';

export default function ViralShortsPage() {
  const t = useTranslations('viralShorts');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [step, setStep] = useState<PageStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translateTone, setTranslateTone] = useState<
    'casual_social_media' | 'polite_educational' | 'formal_corporate' | 'youthful_trendy'
  >('casual_social_media');
  const [voiceOverAudioUrl, setVoiceOverAudioUrl] = useState('');
  const [voiceOverS3Key, setVoiceOverS3Key] = useState('');
  const [voiceOverVoice, setVoiceOverVoice] = useState<string>('kore');
  const [voiceOverEnabled, setVoiceOverEnabled] = useState(false);
  const [originalAudioEnabled, setOriginalAudioEnabled] = useState(true);
  const [voiceOverPlaybackRate, setVoiceOverPlaybackRate] = useState(1);
  const [allowStrongerSync, setAllowStrongerSync] = useState(false);
  const [protectFlip, setProtectFlip] = useState(false);
  const [protectHueDeg, setProtectHueDeg] = useState(0);
  const [balancedSyncGenerationId, setBalancedSyncGenerationId] = useState<number | null>(null);
  const [balancedSyncPreviewUrl, setBalancedSyncPreviewUrl] = useState('');
  const [balancedSyncPreviewS3Key, setBalancedSyncPreviewS3Key] = useState('');
  const [subtitlesGenerationId, setSubtitlesGenerationId] = useState<number | null>(null);
  const [subtitlesSrtKey, setSubtitlesSrtKey] = useState('');
  const [subtitlesDownloadUrl, setSubtitlesDownloadUrl] = useState('');
  const [subtitlesSrtText, setSubtitlesSrtText] = useState('');
  const [subtitlesPosition, setSubtitlesPosition] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.88 });
  const [subtitlesFontSize, setSubtitlesFontSize] = useState(22);
  const [subtitlesBackgroundBlur, setSubtitlesBackgroundBlur] = useState(0);
  const [subtitlesBackgroundOpacity, setSubtitlesBackgroundOpacity] = useState(65);
  const [error, setError] = useState<string | null>(null);
  /** After first signed-in workspace fetch (empty or restored). Until then, avoid flashing the upload UI. */
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const canContinue = useMemo(
    () => Boolean(file) && step !== 'uploading' && step !== 'preparing_workspace',
    [file, step],
  );

  useEffect(() => {
    const resolve = () => setIsSignedIn(Boolean(getStoredAccessToken()));
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setWorkspaceHydrated(false);
      return;
    }
    setWorkspaceHydrated(false);
    let cancelled = false;
    (async () => {
      try {
        const snap = await viralShortsGetWorkspace();
        if (cancelled) return;
        const raw = (snap.workspaceJson ?? '').trim();
        if (!raw || raw === '{}' || raw === 'null') return;
        const blob = parseViralWorkspacePayloadForRestore(raw);
        if (!blob) return;
        const parsed = blob as {
          videoUrl?: string | null;
          videoName?: string | null;
          videoSrc?: string | null;
          transcriptText?: string | null;
          translatedText?: string | null;
          tone?: string | null;
          voiceOverAudioUrl?: string | null;
          voiceOverS3Key?: string | null;
          voiceOverVoice?: string | null;
          voiceOverEnabled?: boolean | null;
          originalAudioEnabled?: boolean | null;
          voiceOverPlaybackRate?: number | null;
          allowStrongerSync?: boolean | null;
          protectFlip?: boolean | null;
          protectHueDeg?: number | null;
          balancedSyncGenerationId?: number | null;
          balancedSyncPreviewUrl?: string | null;
          balancedSyncPreviewS3Key?: string | null;
          subtitlesGenerationId?: number | null;
          subtitlesSrtKey?: string | null;
          subtitlesDownloadUrl?: string | null;
          subtitlesSrtText?: string | null;
          subtitlesPosition?: { x?: number | null; y?: number | null } | null;
          subtitlesFontSize?: number | null;
          subtitlesBackgroundBlur?: number | null;
          subtitlesBackgroundOpacity?: number | null;
          transcript?: string | null; // legacy
          scriptText?: string | null; // legacy
        };
        const url =
          typeof parsed.videoUrl === 'string' && parsed.videoUrl.trim()
            ? parsed.videoUrl.trim()
            : typeof parsed.videoSrc === 'string' && parsed.videoSrc.trim()
              ? parsed.videoSrc.trim()
              : null;
        if (url) {
          setVideoUrl(url);
          setVideoName(typeof parsed.videoName === 'string' ? parsed.videoName : '');
          const restoredTranscript =
            typeof parsed.transcriptText === 'string'
              ? parsed.transcriptText
              : typeof parsed.transcript === 'string'
                ? parsed.transcript
                : typeof parsed.scriptText === 'string'
                  ? parsed.scriptText
                  : '';
          const restoredTranslated = typeof parsed.translatedText === 'string' ? parsed.translatedText : '';
          setTranscriptText(restoredTranscript);
          setTranslatedText(restoredTranslated);
          setVoiceOverAudioUrl(typeof parsed.voiceOverAudioUrl === 'string' ? parsed.voiceOverAudioUrl : '');
          setVoiceOverS3Key(typeof parsed.voiceOverS3Key === 'string' ? parsed.voiceOverS3Key : '');
          const vv = typeof parsed.voiceOverVoice === 'string' ? parsed.voiceOverVoice : '';
          setVoiceOverVoice(normalizePersistedVoiceId(vv));
          setVoiceOverEnabled(Boolean(parsed.voiceOverEnabled));
          setOriginalAudioEnabled(parsed.originalAudioEnabled == null ? true : Boolean(parsed.originalAudioEnabled));
          setVoiceOverPlaybackRate(
            typeof parsed.voiceOverPlaybackRate === 'number' && Number.isFinite(parsed.voiceOverPlaybackRate)
              ? Math.max(0.5, Math.min(2, parsed.voiceOverPlaybackRate))
              : 1,
          );
          setAllowStrongerSync(Boolean(parsed.allowStrongerSync));
          setProtectFlip(Boolean(parsed.protectFlip));
          setProtectHueDeg(
            typeof parsed.protectHueDeg === 'number' && Number.isFinite(parsed.protectHueDeg)
              ? Math.max(0, Math.min(180, parsed.protectHueDeg))
              : 0,
          );
          setBalancedSyncGenerationId(
            typeof parsed.balancedSyncGenerationId === 'number' && Number.isFinite(parsed.balancedSyncGenerationId)
              ? parsed.balancedSyncGenerationId
              : null,
          );
          setBalancedSyncPreviewUrl(typeof parsed.balancedSyncPreviewUrl === 'string' ? parsed.balancedSyncPreviewUrl : '');
          setBalancedSyncPreviewS3Key(
            typeof parsed.balancedSyncPreviewS3Key === 'string' ? parsed.balancedSyncPreviewS3Key : '',
          );
          setSubtitlesGenerationId(
            typeof parsed.subtitlesGenerationId === 'number' && Number.isFinite(parsed.subtitlesGenerationId)
              ? parsed.subtitlesGenerationId
              : null,
          );
          setSubtitlesSrtKey(typeof parsed.subtitlesSrtKey === 'string' ? parsed.subtitlesSrtKey : '');
          setSubtitlesDownloadUrl(typeof parsed.subtitlesDownloadUrl === 'string' ? parsed.subtitlesDownloadUrl : '');
          setSubtitlesSrtText(typeof parsed.subtitlesSrtText === 'string' ? parsed.subtitlesSrtText : '');
        const sp = parsed.subtitlesPosition;
        if (sp && typeof sp === 'object') {
          const x = typeof sp.x === 'number' && Number.isFinite(sp.x) ? Math.max(0, Math.min(1, sp.x)) : 0.5;
          const y = typeof sp.y === 'number' && Number.isFinite(sp.y) ? Math.max(0, Math.min(1, sp.y)) : 0.88;
          setSubtitlesPosition({ x, y });
        }
        setSubtitlesFontSize(
          typeof parsed.subtitlesFontSize === 'number' && Number.isFinite(parsed.subtitlesFontSize)
            ? Math.max(14, Math.min(60, Math.round(parsed.subtitlesFontSize)))
            : 22,
        );
        setSubtitlesBackgroundBlur(
          typeof parsed.subtitlesBackgroundBlur === 'number' && Number.isFinite(parsed.subtitlesBackgroundBlur)
            ? Math.max(0, Math.min(24, Math.round(parsed.subtitlesBackgroundBlur)))
            : 8,
        );
        setSubtitlesBackgroundOpacity(
          typeof parsed.subtitlesBackgroundOpacity === 'number' && Number.isFinite(parsed.subtitlesBackgroundOpacity)
            ? Math.max(0, Math.min(100, Math.round(parsed.subtitlesBackgroundOpacity)))
            : 65,
        );
          const t = (typeof parsed.tone === 'string' ? parsed.tone : '').toLowerCase();
          if (t === 'casual_social_media' || t === 'polite_educational' || t === 'formal_corporate' || t === 'youthful_trendy') {
            setTranslateTone(t);
          } else if (t === 'informal' || t === 'narrative') {
            setTranslateTone('casual_social_media');
          } else if (t === 'formal') {
            setTranslateTone('formal_corporate');
          }
          setStep('studio');
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setWorkspaceHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const handleContinueFromUpload = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep('uploading');
    try {
      const contentType = file.type || 'video/mp4';
      const signed = await videoEditorPrepareUploadUrl(file.name, contentType);
      await uploadFileToPresignedUrl(signed.uploadUrl, file, { contentType });

      const videoUrlWithKey = `${signed.storageUrl}#wk=${encodeURIComponent(signed.s3Key)}`;
      setVideoUrl(videoUrlWithKey);
      setVideoName(file.name);
      setTranscriptText('');
      setTranslatedText('');
      setTranslateTone('casual_social_media');
      setVoiceOverAudioUrl('');
      setVoiceOverS3Key('');
      setVoiceOverVoice('kore');
      setVoiceOverEnabled(false);
      setOriginalAudioEnabled(true);
      setVoiceOverPlaybackRate(1);
      setAllowStrongerSync(false);
      setProtectFlip(false);
      setProtectHueDeg(0);
      setBalancedSyncGenerationId(null);
      setBalancedSyncPreviewUrl('');
      setBalancedSyncPreviewS3Key('');
      setSubtitlesGenerationId(null);
      setSubtitlesSrtKey('');
      setSubtitlesDownloadUrl('');
      setSubtitlesSrtText('');
      setStep('preparing_workspace');

      const viralPayload = {
        videoUrl: videoUrlWithKey,
        videoName: file.name,
        transcriptText: '',
        translatedText: '',
        tone: 'casual_social_media',
        voiceOverAudioUrl: '',
        voiceOverS3Key: '',
        voiceOverVoice: 'kore',
        voiceOverEnabled: false,
        originalAudioEnabled: true,
        voiceOverPlaybackRate: 1,
        allowStrongerSync: false,
        protectFlip: false,
        protectHueDeg: 0,
        balancedSyncGenerationId: null,
        balancedSyncPreviewUrl: '',
        balancedSyncPreviewS3Key: '',
        subtitlesGenerationId: null,
        subtitlesSrtKey: '',
        subtitlesDownloadUrl: '',
        subtitlesSrtText: '',
        subtitlesPosition: { x: 0.5, y: 0.88 },
        subtitlesFontSize: 22,
        subtitlesBackgroundBlur: 0,
        subtitlesBackgroundOpacity: 65,
        step: 'studio',
      };
      await viralShortsSaveSnapshot(JSON.stringify(viralPayload));
      setStep('studio');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg);
      setStep('upload');
    }
  }, [file]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (step !== 'studio' || !videoUrl) return;
    // Keep "current workspace" updated (debounced) including transcript edits.
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const viralPayload = {
            videoUrl,
            videoName,
            transcriptText,
            translatedText,
            tone: translateTone,
            voiceOverAudioUrl,
            voiceOverS3Key,
            voiceOverVoice,
            voiceOverEnabled,
            originalAudioEnabled,
            voiceOverPlaybackRate,
            allowStrongerSync,
            protectFlip,
            protectHueDeg,
            balancedSyncGenerationId,
            balancedSyncPreviewUrl,
            balancedSyncPreviewS3Key,
            subtitlesGenerationId,
            subtitlesSrtKey,
            subtitlesDownloadUrl,
            subtitlesSrtText,
            subtitlesPosition,
            subtitlesFontSize,
            subtitlesBackgroundBlur,
            subtitlesBackgroundOpacity,
            step: 'studio',
          };
          await viralShortsSaveSnapshot(JSON.stringify(viralPayload));
        } catch {
          /* ignore */
        }
      })();
    }, 600);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    isSignedIn,
    step,
    transcriptText,
    translatedText,
    translateTone,
    voiceOverAudioUrl,
    voiceOverVoice,
    voiceOverEnabled,
    originalAudioEnabled,
    voiceOverPlaybackRate,
    allowStrongerSync,
    protectFlip,
    protectHueDeg,
    balancedSyncGenerationId,
    balancedSyncPreviewUrl,
    balancedSyncPreviewS3Key,
    subtitlesGenerationId,
    subtitlesSrtKey,
    subtitlesDownloadUrl,
    subtitlesSrtText,
    subtitlesPosition,
    subtitlesFontSize,
    subtitlesBackgroundBlur,
    subtitlesBackgroundOpacity,
    videoName,
    videoUrl,
  ]);

  const handleNewVideo = useCallback(() => {
    setFile(null);
    setVideoUrl(null);
    setVideoName('');
    setTranscriptText('');
    setTranslatedText('');
    setTranslateTone('casual_social_media');
    setVoiceOverAudioUrl('');
    setVoiceOverS3Key('');
    setVoiceOverVoice('kore');
    setVoiceOverEnabled(false);
    setOriginalAudioEnabled(true);
    setVoiceOverPlaybackRate(1);
    setAllowStrongerSync(false);
    setProtectFlip(false);
    setProtectHueDeg(0);
    setBalancedSyncGenerationId(null);
    setBalancedSyncPreviewUrl('');
    setBalancedSyncPreviewS3Key('');
    setSubtitlesGenerationId(null);
    setSubtitlesSrtKey('');
    setSubtitlesDownloadUrl('');
    setSubtitlesSrtText('');
    setStep('upload');
  }, []);

  const handleDiscardWorkspace = useCallback(async () => {
    setError(null);
    try {
      await viralShortsClearWorkspace();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to discard workspace';
      setError(msg);
      return;
    }
    handleNewVideo();
  }, [handleNewVideo]);

  const flushViralWorkspaceToServer = useCallback(async () => {
    if (!isSignedIn || step !== 'studio' || !videoUrl) return;
    try {
      const viralPayload = {
        videoUrl,
        videoName,
        transcriptText,
        translatedText,
        tone: translateTone,
        voiceOverAudioUrl,
        voiceOverS3Key,
        voiceOverVoice,
        voiceOverEnabled,
        originalAudioEnabled,
        voiceOverPlaybackRate,
        allowStrongerSync,
        protectFlip,
        protectHueDeg,
        balancedSyncGenerationId,
        balancedSyncPreviewUrl,
        balancedSyncPreviewS3Key,
        subtitlesGenerationId,
        subtitlesSrtKey,
        subtitlesDownloadUrl,
        subtitlesSrtText,
        subtitlesPosition,
        subtitlesFontSize,
        subtitlesBackgroundBlur,
        subtitlesBackgroundOpacity,
        step: 'studio',
      };
      await viralShortsSaveSnapshot(JSON.stringify(viralPayload));
    } catch {
      /* best-effort after export */
    }
  }, [
    isSignedIn,
    step,
    videoUrl,
    videoName,
    transcriptText,
    translatedText,
    translateTone,
    voiceOverAudioUrl,
    voiceOverS3Key,
    voiceOverVoice,
    voiceOverEnabled,
    originalAudioEnabled,
    voiceOverPlaybackRate,
    allowStrongerSync,
    protectFlip,
    protectHueDeg,
    balancedSyncGenerationId,
    balancedSyncPreviewUrl,
    balancedSyncPreviewS3Key,
    subtitlesGenerationId,
    subtitlesSrtKey,
    subtitlesDownloadUrl,
    subtitlesSrtText,
    subtitlesPosition,
    subtitlesFontSize,
    subtitlesBackgroundBlur,
    subtitlesBackgroundOpacity,
  ]);

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6 sm:py-10 md:min-h-[calc(100vh-6.5rem)]">
          <div className="w-full min-w-0 space-y-6 sm:space-y-8">
            {!workspaceHydrated ? (
              <div
                className="flex min-h-[min(420px,55vh)] flex-col items-center justify-center gap-4 rounded-2xl border border-card-border bg-card/40 px-6 py-16 text-center shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-10 w-10 shrink-0 animate-spin text-[#7c5cff]" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-foreground">{t('page.loadingWorkspace')}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t('page.loadingWorkspaceHint')}</p>
                </div>
              </div>
            ) : (
              <>
            {step !== 'studio' && step !== 'preparing_workspace' ? (
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="viral-shorts-icon-tile">
                    <Film className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                action={
                  <FeatureHelpButton ariaLabel={t('page.helpAria')} message={t('page.helpMessage')} />
                }
                subtitle={
                  <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
                    {t('page.subtitle')}
                  </p>
                }
              />
            ) : null}

            {step === 'preparing_workspace' ? (
              <div
                className="flex min-h-[min(420px,55vh)] flex-col items-center justify-center gap-4 rounded-2xl border border-card-border bg-card/40 px-6 py-16 text-center shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-10 w-10 shrink-0 animate-spin text-[#7c5cff]" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-foreground">{t('page.preparingWorkspace')}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t('page.preparingWorkspaceHint')}</p>
                </div>
              </div>
            ) : null}

            <section
              aria-labelledby="viral-shorts-panel-heading"
              className={
                step === 'upload' || step === 'uploading' ? 'viral-shorts-upload-panel' : 'hidden'
              }
              aria-hidden={step !== 'upload' && step !== 'uploading'}
              aria-busy={step === 'uploading'}
            >
              <h2 id="viral-shorts-panel-heading" className="sr-only">
                {t('uploadCard.title')}
              </h2>
              <div className="mb-5 flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground">
                <Upload className="h-4 w-4 shrink-0 text-foreground/90" aria-hidden />
                {t('uploadCard.title')}
              </div>

              <UploadZone
                accept="video/mp4,video/webm,.mp4,.webm"
                hideDropzoneIcon
                instructionPrimary={t('uploadZone.instruction')}
                instructionSecondary=""
                dropzoneClassName="viral-shorts-dropzone min-h-[min(220px,36vh)] sm:min-h-[300px] md:min-h-[360px]"
                dropzoneActiveClassName="viral-shorts-dropzone-active"
                className="space-y-4"
                onFileChange={(f) => {
                  setFile(f);
                  setStep('upload');
                  setError(null);
                }}
              />

              <div className="mt-6">
                <ActionButton
                  onClick={handleContinueFromUpload}
                  isLoading={step === 'uploading'}
                  disabled={!canContinue}
                  label={t('continue.label')}
                  loadingLabel={t('continue.loading')}
                  className="btn-viral-shorts"
                />
                {error ? (
                  <p className="mt-3 text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>

            {step === 'studio' && videoUrl ? (
              <CreationStudio
                videoName={videoName}
                videoUrl={videoUrl}
                initialTranscriptText={transcriptText}
                initialTranslatedText={translatedText}
                initialTone={translateTone}
                initialVoiceOverAudioUrl={voiceOverAudioUrl}
                initialVoiceOverS3Key={voiceOverS3Key}
                initialVoiceOverVoice={voiceOverVoice}
                initialVoiceOverEnabled={voiceOverEnabled}
                initialOriginalAudioEnabled={originalAudioEnabled}
                initialVoiceOverPlaybackRate={voiceOverPlaybackRate}
                initialAllowStrongerSync={allowStrongerSync}
                initialProtectFlip={protectFlip}
                initialProtectHueDeg={protectHueDeg}
                initialBalancedSyncGenerationId={balancedSyncGenerationId}
                initialBalancedSyncPreviewUrl={balancedSyncPreviewUrl}
                initialBalancedSyncPreviewS3Key={balancedSyncPreviewS3Key}
                initialSubtitlesGenerationId={subtitlesGenerationId}
                initialSubtitlesSrtKey={subtitlesSrtKey}
                initialSubtitlesDownloadUrl={subtitlesDownloadUrl}
                initialSubtitlesSrtText={subtitlesSrtText}
                initialSubtitlesPosition={subtitlesPosition}
                initialSubtitlesFontSize={subtitlesFontSize}
                initialSubtitlesBackgroundBlur={subtitlesBackgroundBlur}
                initialSubtitlesBackgroundOpacity={subtitlesBackgroundOpacity}
                onTranscriptTextChange={setTranscriptText}
                onTranslatedTextChange={setTranslatedText}
                onToneChange={setTranslateTone}
                onVoiceOverAudioUrlChange={setVoiceOverAudioUrl}
                onVoiceOverS3KeyChange={setVoiceOverS3Key}
                onVoiceOverVoiceChange={setVoiceOverVoice}
                onVoiceOverEnabledChange={setVoiceOverEnabled}
                onOriginalAudioEnabledChange={setOriginalAudioEnabled}
                onVoiceOverPlaybackRateChange={setVoiceOverPlaybackRate}
                onAllowStrongerSyncChange={setAllowStrongerSync}
                onProtectFlipChange={setProtectFlip}
                onProtectHueDegChange={setProtectHueDeg}
                onBalancedSyncGenerationIdChange={setBalancedSyncGenerationId}
                onBalancedSyncPreviewUrlChange={setBalancedSyncPreviewUrl}
                onBalancedSyncPreviewS3KeyChange={setBalancedSyncPreviewS3Key}
                onSubtitlesGenerationIdChange={setSubtitlesGenerationId}
                onSubtitlesSrtKeyChange={setSubtitlesSrtKey}
                onSubtitlesDownloadUrlChange={setSubtitlesDownloadUrl}
                onSubtitlesSrtTextChange={setSubtitlesSrtText}
                onSubtitlesPositionChange={setSubtitlesPosition}
                onSubtitlesFontSizeChange={setSubtitlesFontSize}
                onSubtitlesBackgroundBlurChange={setSubtitlesBackgroundBlur}
                onSubtitlesBackgroundOpacityChange={setSubtitlesBackgroundOpacity}
                onVideoUrlChange={(next) => setVideoUrl(next)}
                onVideoNameChange={(next) => setVideoName(next)}
                onDiscardWorkspace={() => void handleDiscardWorkspace()}
                onExportSuccess={() => void flushViralWorkspaceToServer()}
              />
            ) : null}

            {step === 'studio' && error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
