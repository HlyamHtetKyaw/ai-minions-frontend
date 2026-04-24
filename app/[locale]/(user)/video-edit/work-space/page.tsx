import { Suspense } from 'react';
import { VideoWorkspaceShell } from '@/features/video-edit/components/workspace';

function WorkspaceFallback() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 items-center justify-center bg-black/40"
      aria-hidden
    >
      <div className="h-8 w-8 animate-pulse rounded-full border-2 border-violet-400/30 border-t-violet-400" />
    </div>
  );
}

export default function VideoEditWorkspacePage() {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col">
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <Suspense fallback={<WorkspaceFallback />}>
          <VideoWorkspaceShell />
        </Suspense>
      </div>
    </div>
  );
}
