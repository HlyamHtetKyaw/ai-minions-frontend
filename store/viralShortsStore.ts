import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';

export type ViralClipPreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ViralClip = {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  score: number;
  title: string;
  description: string;
  transcript: string;
  previewUrl: string | null;
  previewStatus: ViralClipPreviewStatus;
  downloadUrl: string | null;
  aspectRatio: '9:16' | '16:9' | '1:1';
  tags: string[];
};

export type ViralShortsJobParams = {
  videoUrl: string;
  videoName: string;
  videoDuration: number;
  targetAspectRatio: '9:16' | '16:9' | '1:1';
  targetDuration: number;
  language: string;
};

export type ViralShortsJobFilter = {
  minScore: number;
  sortBy: 'score' | 'time' | 'duration';
  tags: string[];
};

export type ViralShortsJobStatus = 'pending' | 'analyzing' | 'ready' | 'error';

export type ViralShortsJob = {
  id: string;
  status: ViralShortsJobStatus;
  progress: number;
  analysisMessage: string;
  errorMessage?: string;
  params: ViralShortsJobParams;
  clips: ViralClip[];
  filter: ViralShortsJobFilter;
};

export type ViralShortsState = {
  jobs: Record<string, ViralShortsJob>;
  activeJobId: string | null;
  combineMode: boolean;
  combineSelectedClipIds: string[];
  createJob: (params: ViralShortsJobParams) => string;
  setJobStatus: (jobId: string, status: ViralShortsJobStatus) => void;
  setJobProgress: (jobId: string, progress: number) => void;
  setJobClips: (jobId: string, clips: ViralClip[]) => void;
  updateJob: (jobId: string, partial: Partial<Omit<ViralShortsJob, 'id' | 'params'>>) => void;
  setFilter: (jobId: string, partial: Partial<ViralShortsJobFilter>) => void;
  getFilteredClips: (jobId?: string | null) => ViralClip[];
  setClipPreviewStatus: (
    jobId: string,
    clipId: string,
    previewStatus: ViralClipPreviewStatus,
    previewUrl?: string | null,
  ) => void;
  setClipDownloadUrl: (jobId: string, clipId: string, downloadUrl: string | null) => void;
  setCombineMode: (value: boolean) => void;
  toggleClipForCombine: (clipId: string) => boolean;
  clearCombineSelection: () => void;
  resetActiveJob: () => void;
  removeJob: (jobId: string) => void;
};

const defaultFilter = (): ViralShortsJobFilter => ({
  minScore: 0,
  sortBy: 'score',
  tags: [],
});

function filterAndSortClips(job: ViralShortsJob): ViralClip[] {
  const { filter } = job;
  let list = job.clips.filter((c) => c.score >= filter.minScore);
  if (filter.tags.length > 0) {
    list = list.filter((c) => filter.tags.some((tag) => c.tags.includes(tag)));
  }
  const sorted = [...list];
  if (filter.sortBy === 'score') {
    sorted.sort((a, b) => b.score - a.score);
  } else if (filter.sortBy === 'time') {
    sorted.sort((a, b) => a.startTime - b.startTime);
  } else {
    sorted.sort((a, b) => b.duration - a.duration);
  }
  return sorted;
}

export const useViralShortsStore = create<ViralShortsState>()(
  persist(
    (set, get) => ({
      jobs: {},
      activeJobId: null,
      combineMode: false,
      combineSelectedClipIds: [],

      createJob: (params) => {
        const id = nanoid();
        const job: ViralShortsJob = {
          id,
          status: 'pending',
          progress: 0,
          analysisMessage: '',
          params,
          clips: [],
          filter: defaultFilter(),
        };
        set((s) => ({
          jobs: { ...s.jobs, [id]: job },
          activeJobId: id,
        }));
        return id;
      },

      setJobStatus: (jobId, status) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: { ...job, status },
            },
          };
        }),

      setJobProgress: (jobId, progress) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: { ...job, progress },
            },
          };
        }),

      setJobClips: (jobId, clips) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: { ...job, clips },
            },
          };
        }),

      updateJob: (jobId, partial) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: { ...job, ...partial },
            },
          };
        }),

      setFilter: (jobId, partial) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: {
                ...job,
                filter: { ...job.filter, ...partial },
              },
            },
          };
        }),

      getFilteredClips: (jobId) => {
        const id = jobId ?? get().activeJobId;
        if (!id) return [];
        const job = get().jobs[id];
        if (!job) return [];
        return filterAndSortClips(job);
      },

      setClipPreviewStatus: (jobId, clipId, previewStatus, previewUrl) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          const clips = job.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  previewStatus,
                  previewUrl:
                    previewUrl !== undefined ? previewUrl : c.previewUrl,
                }
              : c,
          );
          return {
            jobs: { ...s.jobs, [jobId]: { ...job, clips } },
          };
        }),

      setClipDownloadUrl: (jobId, clipId, downloadUrl) =>
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          const clips = job.clips.map((c) =>
            c.id === clipId ? { ...c, downloadUrl } : c,
          );
          return {
            jobs: { ...s.jobs, [jobId]: { ...job, clips } },
          };
        }),

      setCombineMode: (value) =>
        set({
          combineMode: value,
          combineSelectedClipIds: [],
        }),

      toggleClipForCombine: (clipId) => {
        const { combineMode, combineSelectedClipIds } = get();
        if (!combineMode) return false;
        if (combineSelectedClipIds.includes(clipId)) {
          set({
            combineSelectedClipIds: combineSelectedClipIds.filter((id) => id !== clipId),
          });
          return true;
        }
        if (combineSelectedClipIds.length >= 2) {
          return false;
        }
        set({ combineSelectedClipIds: [...combineSelectedClipIds, clipId] });
        return true;
      },

      clearCombineSelection: () => set({ combineSelectedClipIds: [], combineMode: false }),

      resetActiveJob: () => set({ activeJobId: null }),

      removeJob: (jobId) =>
        set((s) => {
          const nextJobs = { ...s.jobs };
          delete nextJobs[jobId];
          return {
            jobs: nextJobs,
            activeJobId: s.activeJobId === jobId ? null : s.activeJobId,
          };
        }),
    }),
    {
      name: 'viral-shorts-jobs',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        jobs: s.jobs,
        activeJobId: s.activeJobId,
      }),
    },
  ),
);
