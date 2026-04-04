'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Scissors } from 'lucide-react';
import LoginGate from '@/features/shared/components/LoginGate';
import UploadZone from '@/features/shared/components/UploadZone';
import VideoPreview from '@/features/master-editor/components/VideoPreview';
import Toolbar from '@/features/master-editor/components/Toolbar';
import ExportPanel from '@/features/master-editor/components/ExportPanel';
import {
  TOOLBAR_DEFAULTS,
  FILTER_PRESETS,
  type ToolbarValues,
  type ExportFormat,
  type ExportQuality,
} from '@/features/master-editor/types';

// TODO: replace with real auth state
const isSignedIn = true;

export default function VideoEditPage() {
  const t = useTranslations('video-edit');
  const tShared = useTranslations('shared.uploadZone');

  const [videoSrc, setVideoSrc] = useState('');
  const [toolbarValues, setToolbarValues] = useState<ToolbarValues>(TOOLBAR_DEFAULTS);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
  const [exportQuality, setExportQuality] = useState<ExportQuality>('1080p');
  const [isExporting, setIsExporting] = useState(false);

  const handleFileChange = (file: File | null) => {
    setVideoSrc(file ? URL.createObjectURL(file) : '');
  };

  const handleToolbarChange = (update: Partial<ToolbarValues>) => {
    setToolbarValues((prev) => ({ ...prev, ...update }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // TODO: call export API
    } finally {
      setIsExporting(false);
    }
  };

  const filterStyle = [
    FILTER_PRESETS[toolbarValues.filter],
    `brightness(${toolbarValues.brightness / 100}) contrast(${toolbarValues.contrast / 100}) saturate(${toolbarValues.saturation / 100})`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">
            <div className="video-edit-shell space-y-8">
              <header className="flex gap-4">
                <div className="video-edit-icon-tile" aria-hidden>
                  <Scissors className="h-6 w-6" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {t('page.title')}
                  </h1>
                  <p className="mt-1 text-sm text-muted">{t('page.subtitle')}</p>
                </div>
              </header>

              {!videoSrc ? (
                <UploadZone
                  accept="video/*"
                  kicker={t('uploadZone.kicker')}
                  instructionPrimary={tShared('clickToUpload')}
                  instructionSecondary={tShared('dragDrop')}
                  onFileChange={handleFileChange}
                  dropzoneClassName="video-edit-dropzone"
                  dropzoneActiveClassName="video-edit-dropzone-active"
                  className="space-y-2"
                />
              ) : (
                <div className="space-y-8">
                  <VideoPreview
                    src={videoSrc}
                    filterStyle={filterStyle}
                    playbackRate={toolbarValues.speed}
                  />
                  <Toolbar values={toolbarValues} onChange={handleToolbarChange} />
                  <ExportPanel
                    format={exportFormat}
                    quality={exportQuality}
                    onFormatChange={setExportFormat}
                    onQualityChange={setExportQuality}
                    onExport={handleExport}
                    isExporting={isExporting}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
