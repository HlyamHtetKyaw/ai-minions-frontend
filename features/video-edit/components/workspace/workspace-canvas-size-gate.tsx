'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Monitor, Smartphone, Sparkles } from 'lucide-react';
import { getWorkspacePreviewFrameStyle } from './workspace-preview-frame-style';

export type CanvasGateAspectId = '16:9' | '9:16' | '1:1' | '4:3';

export function canvasAspectIdToEasyRatio(aspect: CanvasGateAspectId): number {
  if (aspect === '16:9') return 16 / 9;
  if (aspect === '9:16') return 9 / 16;
  if (aspect === '1:1') return 1;
  return 4 / 3;
}

function ratioToAspectId(ratio: number): CanvasGateAspectId {
  const options: Array<{ id: CanvasGateAspectId; ratio: number }> = [
    { id: '16:9', ratio: 16 / 9 },
    { id: '9:16', ratio: 9 / 16 },
    { id: '1:1', ratio: 1 },
    { id: '4:3', ratio: 4 / 3 },
  ];
  const nearest = options.reduce((best, item) =>
    Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best,
  );
  return Math.abs(nearest.ratio - ratio) <= 0.01 ? nearest.id : '16:9';
}

const ASPECT_IDS: CanvasGateAspectId[] = ['16:9', '9:16', '1:1', '4:3'];

function aspectToRatioKey(id: CanvasGateAspectId): 'ratio16_9' | 'ratio9_16' | 'ratio1_1' | 'ratio4_3' {
  if (id === '16:9') return 'ratio16_9';
  if (id === '9:16') return 'ratio9_16';
  if (id === '1:1') return 'ratio1_1';
  return 'ratio4_3';
}

function MiniFramePreview({ aspect }: { aspect: CanvasGateAspectId }) {
  const inner =
    aspect === '9:16' ? (
      <div className="h-8 w-[42%] max-w-[2.25rem] rounded-sm bg-gradient-to-b from-zinc-600 to-zinc-800 ring-1 ring-white/10" />
    ) : aspect === '1:1' ? (
      <div className="size-8 rounded-sm bg-gradient-to-br from-zinc-600 to-zinc-800 ring-1 ring-white/10" />
    ) : aspect === '4:3' ? (
      <div className="h-7 w-[58%] max-w-[3.25rem] rounded-sm bg-gradient-to-b from-zinc-600 to-zinc-800 ring-1 ring-white/10" />
    ) : (
      <div className="h-6 w-[72%] max-w-[4rem] rounded-sm bg-gradient-to-b from-zinc-600 to-zinc-800 ring-1 ring-white/10" />
    );
  return (
    <div className="mb-3 flex h-12 w-full items-center justify-center rounded-lg bg-black/40 ring-1 ring-white/[0.06]">
      {inner}
    </div>
  );
}

type WorkspaceCanvasSizeGateProps = {
  initialEasyAspect: number;
  onContinue: (aspect: CanvasGateAspectId) => void;
};

export function WorkspaceCanvasSizeGate({ initialEasyAspect, onContinue }: WorkspaceCanvasSizeGateProps) {
  const t = useTranslations('video-edit.workspace.canvasGate');
  const ta = useTranslations('video-edit.workspace.aspect');
  const [pending, setPending] = useState<CanvasGateAspectId>(() => ratioToAspectId(initialEasyAspect));

  useEffect(() => {
    setPending(ratioToAspectId(initialEasyAspect));
  }, [initialEasyAspect]);

  const isLandscapeFamily = pending === '16:9' || pending === '4:3';

  const previewFrameStyle = useMemo(
    () =>
      getWorkspacePreviewFrameStyle(pending, {
        // Short viewports: cap preview height; tall screens still get a large frame (up to 440px / 52dvh).
        maxHeight: 'clamp(160px, 36dvh, min(52dvh, 440px))',
      }),
    [pending],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#050508]">
      {/* Ambient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
      >
        <div className="absolute left-1/2 top-[-20%] h-[55%] w-[120%] -translate-x-1/2 rounded-full bg-violet-600/[0.12] blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-5%] h-[40%] w-[55%] rounded-full bg-indigo-500/[0.08] blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(99,102,241,0.14),transparent_55%)]" />
      </div>

      <div className="relative z-10 flex min-h-min w-full flex-col items-center justify-start px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:py-8 lg:min-h-0 lg:flex-1 lg:justify-center lg:py-10">
        <div className="grid w-full max-w-5xl gap-6 sm:gap-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-14">
          {/* Live canvas preview */}
          <div className="flex min-h-0 items-center justify-center py-1 sm:min-h-[160px] lg:min-h-[320px]">
            <div
              className={`relative flex justify-center ${
                pending === '9:16' || pending === '1:1' ? 'w-full' : 'w-full max-w-[min(92vw,520px)]'
              }`}
            >
              <div
                className="relative mx-auto overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 to-black shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_32px_64px_-16px_rgba(0,0,0,0.85)] ring-1 ring-violet-500/20 transition-[width,height,aspect-ratio,box-shadow] duration-500 ease-out"
                style={previewFrameStyle}
              >
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.04)_0%,transparent_45%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {t('previewKicker')}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-white tabular-nums">{pending}</p>
                  <p className="max-w-[14rem] text-xs leading-relaxed text-zinc-500">{t('previewHint')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Control panel */}
          <div className="flex flex-col justify-center">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:p-8">
              <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-200/95">
                <Sparkles className="size-3.5 shrink-0 text-violet-300" strokeWidth={2} />
                {t('badge')}
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('title')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t('subtitle')}</p>

              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:mt-8">
                {t('orientationLabel')}
              </p>
              <div className="mt-2.5 flex w-full max-w-full rounded-xl border border-white/[0.06] bg-black/30 p-1 sm:inline-flex sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPending('16:9')}
                  className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-initial sm:gap-2 sm:px-4 sm:py-2.5 ${
                    isLandscapeFamily
                      ? 'bg-gradient-to-b from-violet-500/90 to-violet-600 text-white shadow-lg shadow-violet-900/40'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <Monitor className="size-4 shrink-0 opacity-90" strokeWidth={2} />
                  {t('landscape')}
                </button>
                <button
                  type="button"
                  onClick={() => setPending('9:16')}
                  className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-initial sm:gap-2 sm:px-4 sm:py-2.5 ${
                    pending === '9:16'
                      ? 'bg-gradient-to-b from-violet-500/90 to-violet-600 text-white shadow-lg shadow-violet-900/40'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <Smartphone className="size-4 shrink-0 opacity-90" strokeWidth={2} />
                  {t('portrait')}
                </button>
              </div>

              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:mt-8">
                {t('aspectRatioLabel')}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                {ASPECT_ORDER.map((id) => {
                  const active = pending === id;
                  const labelKey = ASPECT_LABEL_KEY[id];
                  const hint = t(`hints.${labelKey}`);
                  const label = tAspect(labelKey);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPending(id)}
                      className={`group rounded-xl border p-3 text-left transition-all sm:p-4 ${
                        active
                          ? 'border-violet-400/50 bg-violet-500/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-400/30'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]'
                      }`}
                    >
                      <MiniFramePreview aspect={id} />
                      <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-zinc-200'}`}>{label}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onContinue(pending)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 transition hover:from-violet-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 active:scale-[0.99] sm:mt-8"
              >
                {t('continue')}
                <ArrowRight className="size-4" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function workspaceJsonHasPersistedVideo(rawJson: string): boolean {
  try {
    const raw = JSON.parse(rawJson) as {
      videoSrc?: unknown;
      videoSrcKey?: unknown;
    };
    if (raw == null || typeof raw !== 'object') return false;
    const src = typeof raw.videoSrc === 'string' ? raw.videoSrc.trim() : '';
    const key = typeof raw.videoSrcKey === 'string' ? raw.videoSrcKey.trim() : '';
    if (key.length > 0) return true;
    if (src.length > 0 && !src.startsWith('blob:')) return true;
    return false;
  } catch {
    return false;
  }
}
