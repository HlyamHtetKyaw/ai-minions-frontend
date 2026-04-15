'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Film, Upload } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import ActionButton from '@/components/shared/components/action-button';
import AnalyzeButton from '@/components/viralShorts/AnalyzeButton';
import ClipResultsGrid from '@/components/viralShorts/ClipResultsGrid';
import { AUTH_CHANGED_EVENT, getStoredAccessToken } from '@/lib/auth-token';
import { useViralShortsStore } from '@/store/viralShortsStore';

type PageStep = 'upload' | 'settings' | 'analyzing' | 'results';

export default function ViralShortsPage() {
  const t = useTranslations('viralShorts');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [step, setStep] = useState<PageStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(600);
  const [videoName, setVideoName] = useState('');

  const activeJobId = useViralShortsStore((s) => s.activeJobId);

  useEffect(() => {
    const resolve = () => setIsSignedIn(Boolean(getStoredAccessToken()));
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
  }, []);

  useEffect(() => {
    if (!videoUrl || !file) return;

    const video = document.createElement('video');
    video.preload = 'metadata';

    const onMeta = () => {
      const d = video.duration;
      if (Number.isFinite(d) && d > 0) {
        setVideoDuration(d);
      } else {
        setVideoDuration(600);
      }
      video.removeEventListener('loadedmetadata', onMeta);
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.src = videoUrl;

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
    };
  }, [file, videoUrl]);

  const clearJobs = useCallback(() => {
    const { activeJobId: id, removeJob, clearCombineSelection } = useViralShortsStore.getState();
    clearCombineSelection();
    if (id) removeJob(id);
  }, []);

  const handleContinueFromUpload = useCallback(() => {
    if (!file || !videoUrl) return;
    clearJobs();
    setStep('settings');
  }, [clearJobs, file, videoUrl]);

  const handleBackToUpload = useCallback(() => {
    clearJobs();
    setStep('upload');
  }, [clearJobs]);

  const handleNewVideo = useCallback(() => {
    clearJobs();
    setVideoUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setFile(null);
    setVideoName('');
    setVideoDuration(600);
    setStep('upload');
  }, [clearJobs]);

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col px-4 py-8 sm:px-6 sm:py-10">
          <div
            className={`mx-auto w-full space-y-8 ${step === 'results' ? 'max-w-6xl' : 'max-w-2xl'}`}
          >
            {step !== 'results' ? (
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="viral-shorts-icon-tile">
                    <Film className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />
            ) : null}

            <section
              aria-labelledby="viral-shorts-panel-heading"
              className={step === 'upload' ? 'viral-shorts-upload-panel' : 'hidden'}
              aria-hidden={step !== 'upload'}
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
                dropzoneClassName="viral-shorts-dropzone min-h-[min(220px,40vh)] sm:min-h-[260px]"
                dropzoneActiveClassName="viral-shorts-dropzone-active"
                className="space-y-4"
                onFileChange={(f) => {
                  setFile(f);
                  setStep('upload');
                  setVideoUrl((prev) => {
                    if (prev?.startsWith('blob:')) {
                      URL.revokeObjectURL(prev);
                    }
                    if (!f) return null;
                    return URL.createObjectURL(f);
                  });
                  setVideoName(f?.name ?? '');
                  if (!f) {
                    setVideoDuration(600);
                  }
                }}
              />

              <div className="mt-6">
                <ActionButton
                  onClick={handleContinueFromUpload}
                  isLoading={false}
                  disabled={!file}
                  label={t('continue.label')}
                  loadingLabel={t('continue.loading')}
                  className="btn-viral-shorts"
                />
              </div>
            </section>

            {(step === 'settings' || step === 'analyzing') && videoUrl ? (
              <section className="viral-shorts-upload-panel p-5 sm:p-6" aria-label="Analysis settings">
                <AnalyzeButton
                  videoName={videoName}
                  videoDuration={videoDuration}
                  videoUrl={videoUrl}
                  onAnalysisStart={() => setStep('analyzing')}
                  onAnalysisComplete={() => setStep('results')}
                  onAnalysisCancelled={() => setStep('settings')}
                  onBack={handleBackToUpload}
                />
              </section>
            ) : null}

            {step === 'results' && activeJobId ? (
              <ClipResultsGrid jobId={activeJobId} onNewVideo={handleNewVideo} />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
