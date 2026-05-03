'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Upload } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';
import UploadZone from '@/components/shared/components/upload-zone';
import { VIDEO_FILE_ACCEPT_ATTR, isAllowedVideoFile } from '@/components/editor/video-file';
import {
  saveVideoEditorWorkspaceSnapshot,
  uploadVideoEditorFile,
} from '@/lib/video-editor-workspace-api';
import { useRouter } from '@/i18n/navigation';
import { serializeWorkspaceForPersistence } from '@/features/video-edit/lib/workspace-editor-persistence';
import { useEditorStore } from '@/store/editorStore';
import { isHttpWorkspaceReadUrl } from '@/lib/workspace-video-source';
import {
  canvasAspectIdToEasyRatio,
  WorkspaceCanvasSizeGate,
  type CanvasGateAspectId,
} from '@/features/video-edit/components/workspace/workspace-canvas-size-gate';

type UploadPhase = 'frame' | 'upload';

export default function VideoEditWorkspaceUploadPage() {
  const router = useRouter();
  const t = useTranslations('video-edit.workspace.uploadRoute');
  const setVideoSrc = useEditorStore((s) => s.setVideoSrc);
  const setCropSettings = useEditorStore((s) => s.setCropSettings);
  const cropEasyAspect = useEditorStore((s) => s.cropSettings.easyAspect);

  const [phase, setPhase] = useState<UploadPhase>('frame');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const easyAspect = useEditorStore.getState().cropSettings.easyAspect;
    useEditorStore.getState().setVideoSrc(null);
    useEditorStore.getState().setCropSettings({ easyAspect });
  }, []);

  const handleGateContinue = useCallback(
    (aspect: CanvasGateAspectId) => {
      setCropSettings({ easyAspect: canvasAspectIdToEasyRatio(aspect) });
      setPhase('upload');
    },
    [setCropSettings],
  );

  const handleContinue = useCallback(async () => {
    if (!file || !isAllowedVideoFile(file)) return;
    setError(null);
    setUploading(true);
    try {
      const easyAspectBefore = useEditorStore.getState().cropSettings.easyAspect;
      const uploaded = await uploadVideoEditorFile(file);
      if (!isHttpWorkspaceReadUrl(uploaded.storageUrl)) {
        throw new Error('Invalid storage URL from server.');
      }
      const withWorkspaceKey = `${uploaded.storageUrl}#wk=${encodeURIComponent(uploaded.s3Key)}`;
      setVideoSrc(withWorkspaceKey);
      setCropSettings({ easyAspect: easyAspectBefore });
      const payload = serializeWorkspaceForPersistence(useEditorStore.getState());
      await saveVideoEditorWorkspaceSnapshot(payload);
      router.replace('/video-edit/work-space');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file, router, setCropSettings, setVideoSrc]);

  const canContinue = Boolean(file) && !uploading;

  return (
    <div className="flex h-dvh max-h-dvh min-w-0 flex-col overflow-hidden bg-[#050508] text-foreground">
      <header className="shrink-0 border-b border-white/[0.06] bg-black/40 px-[max(1rem,env(safe-area-inset-left,0px))] py-3 pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-white">{t('title')}</p>
        </div>
      </header>

      {phase === 'frame' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <p className="shrink-0 border-b border-white/[0.05] px-[max(1rem,env(safe-area-inset-left,0px))] py-2.5 pr-[max(1rem,env(safe-area-inset-right,0px))] text-xs leading-relaxed text-zinc-400 text-pretty sm:px-6 sm:py-3 sm:text-sm">
            {t('gateSubtitle')}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
            <WorkspaceCanvasSizeGate initialEasyAspect={cropEasyAspect} onContinue={handleGateContinue} />
          </div>
        </div>
      ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-sm leading-relaxed text-zinc-400">{t('uploadStepSubtitle')}</p>

          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-zinc-950/70 p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] sm:p-8">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Upload className="size-4 shrink-0 text-violet-300" strokeWidth={2} aria-hidden />
              {t('dropHeading')}
            </div>

            <UploadZone
              accept={VIDEO_FILE_ACCEPT_ATTR}
              hideDropzoneIcon
              instructionSecondary=""
              instructionPrimary={t('instructionPrimary')}
              dropzoneClassName="min-h-[min(220px,36vh)] rounded-xl border border-dashed border-white/15 bg-black/30 sm:min-h-[280px]"
              dropzoneActiveClassName="border-violet-500/50 bg-violet-500/10"
              className="space-y-4"
              onFileChange={(f) => {
                setFile(f);
                setError(null);
              }}
            />

            <div className="mt-6">
              <ActionButton
                onClick={() => void handleContinue()}
                isLoading={uploading}
                disabled={!canContinue}
                label={t('continue')}
                loadingLabel={t('uploading')}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
              />
              {error ? (
                <p className="mt-3 text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            {uploading ? (
              <p
                className="mt-4 flex items-center gap-2 text-xs text-zinc-500"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="size-3.5 animate-spin text-violet-400" aria-hidden />
                {t('uploadingHint')}
              </p>
            ) : null}
          </div>
        </main>
      )}
    </div>
  );
}
