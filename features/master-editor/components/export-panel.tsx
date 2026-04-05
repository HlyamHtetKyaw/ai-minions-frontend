'use client';

import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';
import type { ExportFormat, ExportQuality } from '../types';

const FORMATS: ExportFormat[] = ['mp4', 'webm', 'mov'];
const QUALITIES: ExportQuality[] = ['1080p', '720p', '480p'];

const QUALITY_I18N: Record<ExportQuality, { title: string; desc: string }> = {
  '1080p': { title: 'res1080Title', desc: 'res1080Desc' },
  '720p': { title: 'res720Title', desc: 'res720Desc' },
  '480p': { title: 'res480Title', desc: 'res480Desc' },
};

type Props = {
  format: ExportFormat;
  quality: ExportQuality;
  onFormatChange: (format: ExportFormat) => void;
  onQualityChange: (quality: ExportQuality) => void;
  onExport: () => void;
  isExporting: boolean;
};

export default function ExportPanel({
  format,
  quality,
  onFormatChange,
  onQualityChange,
  onExport,
  isExporting,
}: Props) {
  const t = useTranslations('master-editor.exportPanel');

  return (
    <div className="video-edit-studio-section space-y-5">
      <p className="text-sm font-semibold text-foreground">{t('title')}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="video-edit-studio-kicker mb-0">{t('formatSection')}</p>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFormatChange(f)}
                className={`video-edit-export-card ${
                  format === f ? 'video-edit-export-card-active' : ''
                }`}
              >
                <span className="video-edit-export-card-title">{t(f)}</span>
                <span className="video-edit-export-card-desc">{t(`${f}Desc`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="video-edit-studio-kicker mb-0">{t('qualitySection')}</p>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            {QUALITIES.map((q) => {
              const keys = QUALITY_I18N[q];
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => onQualityChange(q)}
                  className={`video-edit-export-card ${
                    quality === q ? 'video-edit-export-card-active' : ''
                  }`}
                >
                  <span className="video-edit-export-card-title">{t(keys.title)}</span>
                  <span className="video-edit-export-card-desc">{t(keys.desc)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ActionButton
        label={t('export')}
        loadingLabel={t('exporting')}
        isLoading={isExporting}
        icon={<Download className="h-4 w-4 shrink-0" />}
        onClick={onExport}
        className="btn-transcribe"
      />
    </div>
  );
}
