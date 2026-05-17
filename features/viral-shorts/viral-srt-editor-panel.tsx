'use client';

import { SubtitleStyleControls } from '@/features/viral-shorts/subtitle-style-controls';
import {
  formatSrtTimestamp,
  parseTimeInput,
  type EditableSrtCue,
} from '@/features/viral-shorts/viral-srt-editor-utils';

export type ViralSrtEditorPanelProps = {
  cues: EditableSrtCue[];
  selectedCueId: string | null;
  showOnVideo: boolean;
  moveOnVideo: boolean;
  fontSize: number;
  previewSampleFontPx: number;
  primaryColor: string;
  textOpacity: number;
  backgroundColor: string;
  backgroundOpacity: number;
  disabled?: boolean;
  labels: {
    showOnVideo: string;
    moveOnVideo: string;
    fontSizeExport: string;
    fontSizeExportHint: string;
    textColor: string;
    textOpacity: string;
    captionBackground: string;
    captionBackgroundHint: string;
    backgroundColor: string;
    backgroundOpacity: string;
    generateSubtitlesFirst: string;
    addAfter: string;
    remove: string;
  };
  onSelectCue: (id: string | null) => void;
  onShowOnVideoChange: (show: boolean) => void;
  onMoveOnVideoChange: (move: boolean) => void;
  onFontSizeChange: (size: number) => void;
  onPrimaryColorChange: (color: string) => void;
  onTextOpacityChange: (opacity: number) => void;
  onBackgroundColorChange: (color: string) => void;
  onBackgroundOpacityChange: (opacity: number) => void;
  onCueStartChange: (id: string, startTime: number) => void;
  onCueEndChange: (id: string, endTime: number) => void;
  onCueContentChange: (id: string, content: string) => void;
  onAddCueAfter: (id: string) => void;
  onRemoveCue: (id: string) => void;
};

export function ViralSrtEditorPanel({
  cues,
  selectedCueId,
  showOnVideo,
  moveOnVideo,
  fontSize,
  previewSampleFontPx,
  primaryColor,
  textOpacity,
  backgroundColor,
  backgroundOpacity,
  disabled = false,
  labels,
  onSelectCue,
  onShowOnVideoChange,
  onMoveOnVideoChange,
  onFontSizeChange,
  onPrimaryColorChange,
  onTextOpacityChange,
  onBackgroundColorChange,
  onBackgroundOpacityChange,
  onCueStartChange,
  onCueEndChange,
  onCueContentChange,
  onAddCueAfter,
  onRemoveCue,
}: ViralSrtEditorPanelProps) {
  return (
    <>
      <div className="viral-studio-srt-settings space-y-2 rounded border border-violet-200/50 bg-[#ffffff] p-2 text-[10px] text-foreground dark:border-violet-500/15 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold tabular-nums text-foreground">{cues.length} cues</span>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showOnVideo}
              disabled={disabled}
              onChange={(e) => onShowOnVideoChange(e.target.checked)}
              className="shrink-0"
            />
            <span>{labels.showOnVideo}</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={moveOnVideo}
              disabled={!showOnVideo || disabled}
              onChange={(e) => onMoveOnVideoChange(e.target.checked)}
              className="shrink-0"
            />
            <span>{labels.moveOnVideo}</span>
          </label>
        </div>
        <div className="grid gap-2 border-t border-card-border/60 pt-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.fontSizeExport}
            </p>
            <p className="text-[9px] leading-snug text-muted-foreground/90">{labels.fontSizeExportHint}</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center overflow-hidden rounded border border-violet-200/50 bg-white dark:border-violet-500/15 dark:bg-zinc-900/40">
                <button
                  type="button"
                  className="h-7 w-7 border-r border-card-border text-[13px] font-semibold text-foreground hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
                  onClick={() => onFontSizeChange(Math.max(14, fontSize - 1))}
                  disabled={fontSize <= 14 || disabled}
                  aria-label="Decrease subtitle size"
                >
                  –
                </button>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(fontSize)}
                  disabled={disabled}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    if (!raw) return;
                    const n = Math.max(14, Math.min(60, Number(raw)));
                    if (Number.isFinite(n)) onFontSizeChange(n);
                  }}
                  onBlur={(e) => {
                    const n = Math.max(14, Math.min(60, Number(e.target.value) || 22));
                    onFontSizeChange(Number.isFinite(n) ? n : 22);
                  }}
                  className="h-7 w-9 bg-transparent text-center text-[11px] font-semibold text-foreground outline-none"
                  aria-label="Subtitle size"
                />
                <button
                  type="button"
                  className="h-7 w-7 border-l border-card-border text-[13px] font-semibold text-foreground hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
                  onClick={() => onFontSizeChange(Math.min(60, fontSize + 1))}
                  disabled={fontSize >= 60 || disabled}
                  aria-label="Increase subtitle size"
                >
                  +
                </button>
              </div>
              <select
                value={String(fontSize)}
                disabled={disabled}
                onChange={(e) => {
                  const n = Math.max(14, Math.min(60, Number(e.target.value) || 22));
                  onFontSizeChange(Number.isFinite(n) ? n : 22);
                }}
                className="h-7 rounded border border-violet-200/50 bg-white px-1.5 text-[10px] font-semibold text-foreground outline-none hover:border-violet-400/60 hover:bg-white dark:border-violet-500/15 dark:bg-zinc-900/40 dark:hover:bg-white/5"
                aria-label="Preset subtitle sizes"
              >
                {[14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 60].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}px
                  </option>
                ))}
              </select>
              <span
                className="inline-flex min-h-[1.5rem] min-w-[2rem] items-center justify-center rounded border border-card-border bg-black/60 px-1 font-semibold text-white"
                style={{
                  fontSize: `${Math.min(20, Math.max(8, previewSampleFontPx))}px`,
                  lineHeight: 1.1,
                }}
                title="Sample at preview scale"
              >
                Aa
              </span>
            </div>
          </div>
        </div>
        <SubtitleStyleControls
          primaryColor={primaryColor}
          textOpacity={textOpacity}
          backgroundColor={backgroundColor}
          backgroundOpacity={backgroundOpacity}
          disabled={disabled}
          onPrimaryColorChange={onPrimaryColorChange}
          onTextOpacityChange={onTextOpacityChange}
          onBackgroundColorChange={onBackgroundColorChange}
          onBackgroundOpacityChange={onBackgroundOpacityChange}
          labels={{
            textColor: labels.textColor,
            textOpacity: labels.textOpacity,
            captionBackground: labels.captionBackground,
            captionBackgroundHint: labels.captionBackgroundHint,
            backgroundColor: labels.backgroundColor,
            backgroundOpacity: labels.backgroundOpacity,
          }}
        />
      </div>
      <div className="viral-studio-srt-editor flex min-h-0 max-h-[min(420px,48vh)] flex-col gap-2 bg-white dark:bg-transparent">
        <div className="viral-studio-srt-scroll viral-studio-muted-surface scrollbar-themed min-h-0 flex-1 overflow-auto rounded border border-violet-200/50 bg-white p-1.5 dark:border-violet-400/10 dark:bg-zinc-900/40">
          {cues.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted">{labels.generateSubtitlesFirst}</p>
          ) : (
            <div className="space-y-1.5">
              {cues.slice(0, 80).map((c) => (
                <div
                  key={c.id}
                  data-cue-id={c.id}
                  onClick={() => onSelectCue(selectedCueId === c.id ? null : c.id)}
                  className={`viral-srt-cue-card cursor-pointer rounded-md border bg-white px-2 py-1.5 transition-colors ${
                    selectedCueId === c.id
                      ? 'viral-srt-cue-card--selected border-violet-400 !bg-white ring-2 ring-violet-500/30 dark:border-violet-500/50 dark:bg-violet-500/15 dark:ring-violet-500/25'
                      : 'border-violet-200/70 hover:border-violet-400/50 hover:ring-1 hover:ring-violet-400/20 dark:border-violet-400/10 dark:bg-zinc-900/40 dark:hover:border-violet-400/25 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-2 bg-white dark:bg-transparent">
                    <label className="min-w-[7.5rem] flex-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                      Start
                      <input
                        value={formatSrtTimestamp(c.startTime)}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = parseTimeInput(e.target.value);
                          if (next == null) return;
                          onCueStartChange(c.id, Math.max(0, next));
                        }}
                        className="mt-0.5 h-7 w-full rounded border border-violet-500/25 bg-white px-1.5 font-mono text-[10px] text-foreground outline-none focus:border-violet-500/70 dark:border-violet-400/20 dark:bg-zinc-900/40"
                      />
                    </label>
                    <label className="min-w-[7.5rem] flex-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                      End
                      <input
                        value={formatSrtTimestamp(c.endTime)}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = parseTimeInput(e.target.value);
                          if (next == null) return;
                          onCueEndChange(c.id, Math.max(next, c.startTime + 0.05));
                        }}
                        className="mt-0.5 h-7 w-full rounded border border-violet-500/25 bg-white px-1.5 font-mono text-[10px] text-foreground outline-none focus:border-violet-500/70 dark:border-violet-400/20 dark:bg-zinc-900/40"
                      />
                    </label>
                    <div className="ml-auto flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="viral-srt-add-after-btn h-7 appearance-none rounded border border-violet-500/25 bg-[#ffffff] px-2 text-[10px] font-semibold text-foreground hover:border-violet-400/60 dark:border-violet-400/20 dark:bg-zinc-900/40"
                        disabled={disabled}
                        onClick={() => onAddCueAfter(c.id)}
                      >
                        {labels.addAfter}
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded border border-red-500/35 bg-transparent px-2 text-[10px] font-semibold text-red-300 hover:bg-red-500/10"
                        disabled={disabled}
                        onClick={() => onRemoveCue(c.id)}
                      >
                        {labels.remove}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border-2 border-dashed border-[#7c5cff]/40 bg-white p-2 dark:bg-white/5">
                    <textarea
                      value={c.content}
                      disabled={disabled}
                      onChange={(e) => onCueContentChange(c.id, e.target.value)}
                      rows={3}
                      className="box-border min-h-[5.5rem] w-full resize-y rounded-md border border-violet-500/25 bg-white px-2.5 py-2 text-[12px] leading-relaxed text-foreground outline-none focus:border-violet-500/70 dark:border-violet-400/20 dark:bg-zinc-900/40"
                    />
                  </div>
                </div>
              ))}
              {cues.length > 80 ? (
                <p className="px-1 py-0.5 text-[10px] text-muted">Showing first 80 cues.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
