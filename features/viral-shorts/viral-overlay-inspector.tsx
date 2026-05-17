'use client';

import type { ReactNode } from 'react';
import { MousePointer2, Sparkles, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BlurLayer, TextLayer } from '@/store/editorStore';
import type { ViralActiveTool } from '@/features/viral-shorts/viral-overlay-store';

type Props = {
  activeTool: ViralActiveTool;
  onActiveTool: (tool: ViralActiveTool) => void;
  selectedText: TextLayer | null;
  selectedBlur: BlurLayer | null;
  durationReady: boolean;
  onAddText: () => void;
  onAddBlur: () => void;
  onUpdateText: (id: string, patch: Partial<TextLayer>) => void;
  onUpdateBlur: (id: string, patch: Partial<BlurLayer>) => void;
  onDelete: () => void;
};

export function ViralOverlayInspector({
  activeTool,
  onActiveTool,
  selectedText,
  selectedBlur,
  durationReady,
  onAddText,
  onAddBlur,
  onUpdateText,
  onUpdateBlur,
  onDelete,
}: Props) {
  const t = useTranslations('viralShorts.overlays');

  const toolBtn = (tool: ViralActiveTool, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => onActiveTool(tool)}
      className={
        activeTool === tool
          ? 'viral-overlay-tool-active flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold'
          : 'viral-overlay-tool-idle flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium hover:bg-violet-50/60 dark:hover:bg-white/5'
      }
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="viral-overlay-inspector space-y-2 border-b border-zinc-200/90 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionTitle')}
        </span>
        {toolBtn('pointer', t('pointer'), <MousePointer2 className="h-3.5 w-3.5" />)}
        {toolBtn('text', t('textTool'), <Type className="h-3.5 w-3.5" />)}
        {toolBtn('blur', t('blurTool'), <Sparkles className="h-3.5 w-3.5" />)}
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
        {(selectedText != null || selectedBlur != null) && (
          <button
            type="button"
            onClick={onDelete}
            className="viral-overlay-remove ml-auto h-8 rounded-md border px-2 text-[10px] font-semibold hover:opacity-90 dark:border-red-500/40 dark:bg-red-500/5 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            {t('remove')}
          </button>
        )}
      </div>

      {selectedText != null && (
        <div className="rounded-lg border border-card-border bg-subtle/20 p-2">
          <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{t('inspectorText')}</p>
          <label className="block text-[10px] text-muted-foreground">
            {t('content')}
            <textarea
              value={selectedText.content}
              onChange={(e) => onUpdateText(selectedText.id, { content: e.target.value })}
              rows={2}
              className="mt-0.5 w-full resize-y rounded border border-card-border bg-card px-2 py-1 text-[12px] text-foreground"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="text-[10px] text-muted-foreground">
              {t('fontSize')}
              <input
                type="number"
                min={8}
                max={200}
                value={selectedText.fontSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) onUpdateText(selectedText.id, { fontSize: n });
                }}
                className="ml-1 w-16 rounded border border-card-border bg-card px-1 py-0.5 text-[11px]"
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              {t('color')}
              <input
                type="color"
                value={selectedText.color.startsWith('#') ? selectedText.color : '#ffffff'}
                onChange={(e) => onUpdateText(selectedText.id, { color: e.target.value })}
                className="ml-1 h-7 w-10 cursor-pointer rounded border border-card-border bg-card"
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              {t('opacity')}
              <input
                type="range"
                min={0}
                max={100}
                value={selectedText.opacity}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) onUpdateText(selectedText.id, { opacity: n });
                }}
                className="ml-1 w-24 align-middle"
              />
            </label>
          </div>
        </div>
      )}

      {selectedBlur != null && (
        <div className="rounded-lg border border-card-border bg-subtle/20 p-2">
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

      <p className="text-[9px] text-muted-foreground">{t('keyboardHint')}</p>
    </div>
  );
}
