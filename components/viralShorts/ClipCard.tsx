'use client';

import { useCallback, useState } from 'react';
import { Download, Loader2, Eye, Play, RefreshCw } from 'lucide-react';
import { formatTime, withVideoSeekHash } from '@/lib/viralShortsHelpers';
import type { ViralClip } from '@/store/viralShortsStore';
import { useViralShortsStore } from '@/store/viralShortsStore';

type Props = {
  clip: ViralClip;
  jobId: string;
  videoUrl: string;
  onSeeDetails: (clipId: string) => void;
};

export default function ClipCard({
  clip,
  jobId,
  videoUrl,
  onSeeDetails,
}: Props) {
  const setClipPreviewStatus = useViralShortsStore((s) => s.setClipPreviewStatus);
  const setClipDownloadUrl = useViralShortsStore((s) => s.setClipDownloadUrl);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const loadPreview = useCallback(() => {
    setClipPreviewStatus(jobId, clip.id, 'loading');
    window.setTimeout(() => {
      const url = withVideoSeekHash(videoUrl, clip.startTime);
      setClipPreviewStatus(jobId, clip.id, 'ready', url);
    }, 1500);
  }, [clip.id, clip.startTime, jobId, setClipPreviewStatus, videoUrl]);

  const handleDownload = useCallback(async () => {
    if (clip.downloadUrl) {
      const a = document.createElement('a');
      a.href = clip.downloadUrl;
      a.download = `${clip.title.replace(/\s+/g, '-')}.mp4`;
      a.click();
      return;
    }
    setDownloadBusy(true);
    await new Promise((r) => setTimeout(r, 1500));
    const blob = new Blob([], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    setClipDownloadUrl(jobId, clip.id, url);
    setDownloadBusy(false);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clip.title.replace(/\s+/g, '-')}.mp4`;
    a.click();
  }, [clip.downloadUrl, clip.id, clip.title, jobId, setClipDownloadUrl]);

  const scoreBg =
    clip.score >= 90 ? '#EF9F27' : clip.score >= 80 ? '#534AB7' : clip.score >= 70 ? '#1D9E75' : '#333';

  return (
    <article className="relative flex flex-col overflow-hidden rounded-[10px] border border-[#2a2a3a] bg-[#161622] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#534AB7]">
      <div className="relative h-[160px] bg-[#0d0d1a]">
        <div className="absolute right-2 top-2 z-10 rounded px-2 py-0.5 text-[11px] text-white bg-black/70">
          {formatTime(clip.startTime)} — {formatTime(clip.endTime)}
        </div>

        {clip.previewStatus === 'idle' ? (
          <button
            type="button"
            onClick={loadPreview}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#666] transition-colors hover:text-[#aaa]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-current">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
            <span className="text-xs">Load preview</span>
          </button>
        ) : null}

        {clip.previewStatus === 'loading' ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#7F77DD]" aria-hidden />
          </div>
        ) : null}

        {clip.previewStatus === 'ready' && clip.previewUrl ? (
          <video
            key={clip.previewUrl}
            src={clip.previewUrl}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : null}

        {clip.previewStatus === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-xs text-[#aaa]">Preview failed</p>
            <button
              type="button"
              onClick={loadPreview}
              className="inline-flex items-center gap-1 rounded-md border border-[#333] px-2 py-1 text-[11px] text-[#aaa] hover:border-[#534AB7]"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : null}

        <div
          className="absolute bottom-2.5 left-2.5 z-10 rounded px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: scoreBg }}
        >
          Score: {clip.score}
        </div>

        <div className="absolute bottom-2 right-2 z-10 flex max-w-[calc(100%-4.5rem)] flex-wrap justify-end gap-1">
          {clip.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-[10px] px-[7px] py-0.5 text-[9px] text-[#AFA9EC]"
              style={{ background: 'rgba(83,74,183,0.3)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="mb-3 line-clamp-3 text-[12px] leading-snug text-[#aaa]">
          {clip.description}
        </p>

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloadBusy}
            className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#1D9E75] text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download
          </button>
          <button
            type="button"
            onClick={() => onSeeDetails(clip.id)}
            className="flex h-9 w-[7.25rem] shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-[#333] bg-transparent text-xs font-medium text-[#aaa] transition-colors hover:border-[#534AB7] hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            See details
          </button>
        </div>
      </div>
    </article>
  );
}
