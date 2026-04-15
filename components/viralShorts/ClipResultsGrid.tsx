'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Film, Eye } from 'lucide-react';
import ClipCard from '@/components/viralShorts/ClipCard';
import { formatTime, withVideoSeekHash } from '@/lib/viralShortsHelpers';
import { useViralShortsStore } from '@/store/viralShortsStore';

type Props = {
  jobId: string;
  onNewVideo?: () => void;
};

export default function ClipResultsGrid({ jobId, onNewVideo }: Props) {
  const t = useTranslations('viralShorts');
  const job = useViralShortsStore((s) => s.jobs[jobId]);
  const getFilteredClips = useViralShortsStore((s) => s.getFilteredClips);
  const setFilter = useViralShortsStore((s) => s.setFilter);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!jobId || !job) return [];
    return getFilteredClips(jobId);
  }, [jobId, job, getFilteredClips]);

  const allTags = useMemo(() => {
    if (!job) return [];
    const set = new Set<string>();
    for (const c of job.clips) {
      for (const tag of c.tags) set.add(tag);
    }
    return [...set].sort();
  }, [job]);

  const filter = job?.filter;

  const handleTagClick = (tag: string) => {
    if (!job) return;
    const next = filter?.tags.includes(tag)
      ? filter.tags.filter((x) => x !== tag)
      : [...(filter?.tags ?? []), tag];
    setFilter(jobId, { tags: next });
  };

  if (!job) {
    return (
      <p className="text-sm text-muted">
        No analysis job found. Start over from upload.
        {onNewVideo ? (
          <button type="button" className="ml-2 underline" onClick={onNewVideo}>
            New video
          </button>
        ) : null}
      </p>
    );
  }

  const videoUrl = job.params.videoUrl;
  const videoName = job.params.videoName;
  const selectedClip = selectedClipId ? job.clips.find((clip) => clip.id === selectedClipId) : null;

  if (selectedClip) {
    const previewSrc = withVideoSeekHash(videoUrl, selectedClip.startTime);
    const detailText =
      selectedClip.transcript.trim() ||
      selectedClip.description ||
      'AI analysis details will appear here.';

    return (
      <div className="space-y-4">
        <section className="viral-shorts-upload-panel p-4 sm:p-6">
          <p className="mb-3 inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <Eye className="h-4 w-4" aria-hidden />
            See details
          </p>

          <div className="overflow-hidden rounded-xl border border-[#2a2a3a] bg-[#0d0d1a]">
            <video src={previewSrc} className="h-auto max-h-[420px] w-full object-cover" controls playsInline />
          </div>

          <div className="mt-4 rounded-lg border border-[#2a2a3a] bg-card/50 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Clip details</p>
            <p className="text-sm leading-relaxed text-foreground">{detailText}</p>
            <p className="mt-2 text-xs text-muted">
              {formatTime(selectedClip.startTime)} — {formatTime(selectedClip.endTime)}
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setSelectedClipId(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to clips
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex gap-4">
        <div className="viral-shorts-icon-tile shrink-0">
          <Film className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('page.title')}</h1>
          <p className="mt-1 text-sm text-muted">
            {job.clips.length} viral moments found in {videoName}
          </p>
        </div>
      </header>

      {allTags.length > 0 ? (
        <div className="viral-shorts-upload-panel p-4 sm:p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Tags</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const active = filter?.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-[#534AB7] text-white' : 'border border-[#2a2a3a] bg-[#12121c] text-muted'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            jobId={jobId}
            videoUrl={videoUrl}
            onSeeDetails={setSelectedClipId}
          />
        ))}
      </div>

      {onNewVideo ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={onNewVideo}
            className="text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            New video
          </button>
        </div>
      ) : null}
    </div>
  );
}
