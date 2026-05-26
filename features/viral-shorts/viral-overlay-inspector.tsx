'use client';

import { useTranslations } from 'next-intl';
import type { BlurLayer, GalleryImage, ImageLayer, TextLayer } from '@/store/editorStore';
import type { ViralActiveTool } from '@/features/viral-shorts/viral-overlay-store';
import { ViralImageGalleryPanel } from '@/features/viral-shorts/viral-image-gallery-panel';
import { ViralImageProperties } from '@/features/viral-shorts/viral-image-properties';
import { ViralTextProperties } from '@/features/viral-shorts/viral-text-properties';

type Props = {
  activeTool: ViralActiveTool;
  onActiveTool: (tool: ViralActiveTool) => void;
  selectedText: TextLayer | null;
  selectedBlur: BlurLayer | null;
  selectedImage: ImageLayer | null;
  previewDurationSec: number;
  durationReady: boolean;
  canvasW: number;
  canvasH: number;
  onAddText: () => void;
  onAddBlur: () => void;
  onAddImageToCanvas: (img: GalleryImage) => void;
  onAddLogo: (img: GalleryImage) => void;
  onUpdateText: (id: string, patch: Partial<TextLayer>) => void;
  onUpdateBlur: (id: string, patch: Partial<BlurLayer>) => void;
  onUpdateImage: (id: string, patch: Partial<ImageLayer>) => void;
  onDelete: () => void;
};

export function ViralOverlayInspector({
  selectedText,
  selectedBlur,
  selectedImage,
  previewDurationSec,
  durationReady,
  canvasW,
  canvasH,
  onAddText,
  onAddBlur,
  onAddImageToCanvas,
  onAddLogo,
  onUpdateText,
  onUpdateBlur,
  onUpdateImage,
  onDelete,
}: Props) {
  const t = useTranslations('viralShorts.overlays');

  return (
    <div className="viral-overlay-inspector space-y-2 border-b border-violet-200/50 bg-white px-3 py-2 dark:border-violet-500/15 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionTitle')}
        </span>
        <button
          type="button"
          disabled={!durationReady}
          onClick={onAddText}
          className="viral-overlay-add-text h-8 rounded-md border px-2 text-[10px] font-semibold hover:opacity-90 disabled:opacity-40 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
        >
          {t('addText')}
        </button>
        <button
          type="button"
          disabled={!durationReady}
          onClick={onAddBlur}
          className="viral-overlay-add-blur h-8 rounded-md border px-2 text-[10px] font-semibold hover:opacity-90 disabled:opacity-40 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
        >
          {t('addBlur')}
        </button>
        {(selectedText != null || selectedBlur != null || selectedImage != null) && (
          <button
            type="button"
            onClick={onDelete}
            className="viral-overlay-remove ml-auto h-8 rounded-md border px-2 text-[10px] font-semibold hover:opacity-90 dark:border-red-500/40 dark:bg-red-500/5 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            {t('remove')}
          </button>
        )}
      </div>

      {selectedText != null && selectedText.srtImportBatchId ? (
        <p className="rounded-md border border-violet-200/60 bg-violet-50/80 px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground dark:border-violet-400/15 dark:bg-violet-500/10">
          Edit caption text, timing, and style in the SRT Editor tab.
        </p>
      ) : null}

      {selectedText != null && !selectedText.srtImportBatchId ? (
        <div className="rounded-lg border border-violet-500/20 bg-white p-2 dark:border-violet-400/15 dark:bg-zinc-900/40">
          <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{t('inspectorText')}</p>
          <ViralTextProperties
            layer={selectedText}
            durationSec={previewDurationSec}
            onUpdate={onUpdateText}
            onDelete={onDelete}
          />
        </div>
      ) : null}

      {selectedBlur != null && (
        <div className="rounded-lg border border-violet-500/20 bg-white p-2 dark:border-violet-400/15 dark:bg-zinc-900/40">
          <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{t('inspectorBlur')}</p>
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {t('intensity')}
            <input
              type="range"
              min={1}
              max={80}
              value={selectedBlur.intensity}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onUpdateBlur(selectedBlur.id, { intensity: n });
              }}
              className="w-40"
            />
            <span className="tabular-nums text-foreground">{selectedBlur.intensity}</span>
          </label>
          <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            {t('blurOpacity')}
            <input
              type="range"
              min={0}
              max={100}
              value={selectedBlur.opacity}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onUpdateBlur(selectedBlur.id, { opacity: n });
              }}
              className="w-40"
            />
          </label>
        </div>
      )}

      {selectedImage != null ? (
        <div className="rounded-lg border border-violet-500/20 bg-white p-2 dark:border-violet-400/15 dark:bg-zinc-900/40">
          <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{t('inspectorImage')}</p>
          <ViralImageProperties
            layer={selectedImage}
            durationSec={previewDurationSec}
            onUpdate={onUpdateImage}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-violet-500/20 bg-white p-2 dark:border-violet-400/15 dark:bg-zinc-900/40">
          <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{t('inspectorImages')}</p>
          <ViralImageGalleryPanel
            canvasW={canvasW}
            canvasH={canvasH}
            onAddToCanvas={onAddImageToCanvas}
            onAddAsLogo={onAddLogo}
          />
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">{t('keyboardHint')}</p>
    </div>
  );
}
