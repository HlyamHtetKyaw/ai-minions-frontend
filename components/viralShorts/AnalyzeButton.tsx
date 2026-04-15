'use client';

import { useViralAnalysis } from '@/hooks/useViralAnalysis';
import { useViralShortsStore } from '@/store/viralShortsStore';
import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, CircleX, Sparkles } from 'lucide-react';

type Props = {
  videoName: string;
  videoDuration: number;
  videoUrl: string;
  onAnalysisStart?: () => void;
  onAnalysisComplete?: () => void;
  onAnalysisCancelled?: () => void;
  onBack?: () => void;
};

const DURATIONS = [15, 30, 60, 90] as const;

export default function AnalyzeButton({
  videoName,
  videoDuration,
  videoUrl,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisCancelled,
  onBack,
}: Props) {
  const { runAnalysis, cancelAnalysis, retryAnalysis, activeJobId } = useViralAnalysis();
  const removeJob = useViralShortsStore((s) => s.removeJob);
  const job = useViralShortsStore((s) => {
    const id = s.activeJobId;
    return id ? s.jobs[id] : undefined;
  });

  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [targetDuration, setTargetDuration] = useState<number>(60);

  const isAnalyzing = job?.status === 'analyzing';
  const isError = job?.status === 'error';
  const isReady = job?.status === 'ready';

  const run = useCallback(async () => {
    onAnalysisStart?.();
    await runAnalysis({
      videoUrl,
      videoName,
      videoDuration,
      targetAspectRatio: aspect,
      targetDuration,
      language: 'auto',
    });
    const id = useViralShortsStore.getState().activeJobId;
    if (id && useViralShortsStore.getState().jobs[id]?.status === 'ready') {
      onAnalysisComplete?.();
    }
  }, [
    aspect,
    targetDuration,
    onAnalysisStart,
    onAnalysisComplete,
    runAnalysis,
    videoDuration,
    videoName,
    videoUrl,
  ]);

  const handleRetry = useCallback(async () => {
    if (!activeJobId) return;
    onAnalysisStart?.();
    await retryAnalysis(activeJobId);
    if (useViralShortsStore.getState().jobs[activeJobId]?.status === 'ready') {
      onAnalysisComplete?.();
    }
  }, [activeJobId, onAnalysisStart, onAnalysisComplete, retryAnalysis]);

  const progress = job?.progress ?? 0;
  const message = job?.analysisMessage ?? '';
  const errorMessage = job?.errorMessage;

  const aspectButtons = useMemo(
    () =>
      (['9:16', '16:9', '1:1'] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => setAspect(a)}
          className={`min-w-[3.25rem] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            aspect === a
              ? 'bg-[#534AB7] text-white'
              : 'border border-[#2a2a3a] bg-[#12121c] text-[#aaa] hover:border-[#534AB7]/50'
          }`}
        >
          {a}
        </button>
      )),
    [aspect],
  );

  if (isReady) {
    return null;
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Sparkles
            className="viral-shorts-analyze-spin mt-0.5 h-5 w-5 shrink-0 text-[#7F77DD]"
            aria-hidden
          />
          <p className="text-[14px] leading-snug text-[#AFA9EC]" aria-live="polite">
            {message || 'Starting…'}
          </p>
        </div>

        <div className="flex gap-1.5 pl-8">
          <span className="viral-shorts-analyze-dot inline-block" />
          <span className="viral-shorts-analyze-dot inline-block" />
          <span className="viral-shorts-analyze-dot inline-block" />
        </div>

        <div className="space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-[#1e1e2e]">
            <div
              className="h-full rounded-[3px] bg-gradient-to-r from-[#534AB7] to-[#7F77DD]"
              style={{
                width: `${progress}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <p className="text-right text-xs font-semibold text-[#7F77DD] tabular-nums">{progress}%</p>
        </div>

        {activeJobId ? (
          <button
            type="button"
            onClick={() => {
              cancelAnalysis(activeJobId);
              removeJob(activeJobId);
              onAnalysisCancelled?.();
            }}
            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <CircleX className="mt-0.5 h-8 w-8 shrink-0 text-red-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">Analysis failed. Please try again.</p>
            {errorMessage ? (
              <p className="mt-1 text-xs text-muted leading-relaxed">{errorMessage}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleRetry()}
          className="w-full rounded-xl border-2 border-[#534AB7] bg-transparent py-3 text-[15px] font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.99]"
        >
          Try again
        </button>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="mb-4 text-[14px] text-muted leading-relaxed">
        Video uploaded. Run AI to detect viral moments.
      </p>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Aspect ratio</p>
        <div className="flex flex-wrap gap-2">{aspectButtons}</div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Max clip duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setTargetDuration(d)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                targetDuration === d
                  ? 'bg-[#534AB7] text-white'
                  : 'border border-[#2a2a3a] bg-[#12121c] text-[#aaa] hover:border-[#534AB7]/50'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void run()}
        className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-[transform,filter] hover:brightness-110 hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: 'linear-gradient(135deg, #7F77DD, #534AB7)',
        }}
      >
        <Sparkles className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
        Analyze for viral clips
      </button>

      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      ) : null}
    </div>
  );
}
