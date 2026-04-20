import { Suspense } from 'react';
import { VideoWorkspaceShell } from '@/features/video-edit/components/workspace';

function WorkspaceFallback() {
  return (
    <div
      className="flex min-h-[560px] flex-1 items-center justify-center rounded-xl border border-white/10 bg-black/40"
      aria-hidden
    >
      <div className="h-8 w-8 animate-pulse rounded-full border-2 border-violet-400/30 border-t-violet-400" />
    </div>
  );
}

export default function VideoEditWorkspacePage() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col">
        <Suspense fallback={<WorkspaceFallback />}>
          <VideoWorkspaceShell />
        </Suspense>
      </div>
    </div>
  );
}
