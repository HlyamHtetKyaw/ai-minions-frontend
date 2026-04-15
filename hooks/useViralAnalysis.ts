import { useCallback, useRef } from 'react';
import { generateMockClips } from '@/lib/viralShortsMock';
import { useViralShortsStore, type ViralShortsJobParams } from '@/store/viralShortsStore';

const STAGES: { progress: number; delay: number; message: string }[] = [
  { progress: 8, delay: 600, message: 'Extracting audio track...' },
  { progress: 18, delay: 900, message: 'Transcribing speech...' },
  { progress: 30, delay: 1200, message: 'Analyzing speech patterns...' },
  { progress: 42, delay: 800, message: 'Detecting scene changes...' },
  { progress: 55, delay: 1000, message: 'Scoring engagement signals...' },
  { progress: 67, delay: 700, message: 'Identifying viral moments...' },
  { progress: 78, delay: 900, message: 'Ranking clips by virality...' },
  { progress: 88, delay: 600, message: 'Generating clip previews...' },
  { progress: 95, delay: 500, message: 'Finalizing results...' },
  { progress: 100, delay: 400, message: 'Done!' },
];

export function useViralAnalysis() {
  const createJob = useViralShortsStore((s) => s.createJob);
  const setJobStatus = useViralShortsStore((s) => s.setJobStatus);
  const setJobProgress = useViralShortsStore((s) => s.setJobProgress);
  const setJobClips = useViralShortsStore((s) => s.setJobClips);
  const updateJob = useViralShortsStore((s) => s.updateJob);
  const activeJobId = useViralShortsStore((s) => s.activeJobId);
  const runTokenRef = useRef(0);

  const simulateStages = useCallback(
    async (jobId: string, params: ViralShortsJobParams) => {
      const token = ++runTokenRef.current;
      setJobStatus(jobId, 'analyzing');
      setJobProgress(jobId, 0);
      updateJob(jobId, { analysisMessage: '', errorMessage: undefined });

      try {
        for (const stage of STAGES) {
          await new Promise<void>((resolve) => setTimeout(resolve, stage.delay));
          if (runTokenRef.current !== token) return;
          const job = useViralShortsStore.getState().jobs[jobId];
          if (!job || job.status !== 'analyzing') {
            return;
          }
          setJobProgress(jobId, stage.progress);
          updateJob(jobId, { analysisMessage: stage.message });
        }

        if (runTokenRef.current !== token) return;
        const jobAfter = useViralShortsStore.getState().jobs[jobId];
        if (!jobAfter || jobAfter.status !== 'analyzing') return;

        const clips = generateMockClips(
          params.videoDuration,
          params.targetDuration,
          8,
          params.targetAspectRatio,
        );
        setJobClips(jobId, clips);
        setJobStatus(jobId, 'ready');
        updateJob(jobId, { analysisMessage: 'Done!' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        useViralShortsStore.getState().updateJob(jobId, {
          errorMessage: msg,
          analysisMessage: '',
        });
        useViralShortsStore.getState().setJobStatus(jobId, 'error');
      }
    },
    [setJobStatus, setJobProgress, setJobClips, updateJob],
  );

  const runAnalysis = useCallback(
    async (params: ViralShortsJobParams) => {
      const jobId = createJob(params);
      await simulateStages(jobId, params);
    },
    [createJob, simulateStages],
  );

  const cancelAnalysis = useCallback((jobId: string) => {
    runTokenRef.current += 1;
    const job = useViralShortsStore.getState().jobs[jobId];
    if (!job) return;
    useViralShortsStore.getState().setJobStatus(jobId, 'pending');
    useViralShortsStore.getState().setJobProgress(jobId, 0);
    useViralShortsStore.getState().updateJob(jobId, {
      analysisMessage: '',
      clips: [],
      errorMessage: undefined,
    });
  }, []);

  const retryAnalysis = useCallback(
    async (jobId: string) => {
      const job = useViralShortsStore.getState().jobs[jobId];
      if (!job) return;
      useViralShortsStore.getState().updateJob(jobId, {
        errorMessage: undefined,
        clips: [],
        analysisMessage: '',
      });
      useViralShortsStore.getState().setJobProgress(jobId, 0);
      await simulateStages(jobId, job.params);
    },
    [simulateStages],
  );

  return { runAnalysis, cancelAnalysis, retryAnalysis, activeJobId };
}
