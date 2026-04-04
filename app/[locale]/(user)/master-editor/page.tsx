'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

export default function MasterEditorPage() {
  const t = useTranslations('master-editor');

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState('');
  const [toolbarValues, setToolbarValues] = useState<ToolbarValues>(TOOLBAR_DEFAULTS);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
  const [exportQuality, setExportQuality] = useState<ExportQuality>('1080p');
  const [isExporting, setIsExporting] = useState(false);

  const handleFileChange = (file: File | null) => {
    setVideoFile(file);
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

  // Compute CSS filter string from preset + adjust sliders
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
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>

          {!videoSrc ? (
            <UploadZone
              accept="video/*"
              label={t('uploadZone.label')}
              onFileChange={handleFileChange}
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </>
  );
}
