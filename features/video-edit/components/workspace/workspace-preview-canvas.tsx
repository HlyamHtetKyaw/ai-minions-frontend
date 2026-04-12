'use client';

import { forwardRef } from 'react';
import { VideoCanvas } from '@/components/editor/VideoCanvas';

export const WORKSPACE_VIDEO_FILE_INPUT_ID = 'workspace-video-file-input';

type WorkspacePreviewCanvasProps = {
  canvasLabel: string;
};

/** `ref` targets the framed preview (used for fullscreen from the timeline). */
export const WorkspacePreviewCanvas = forwardRef<HTMLDivElement, WorkspacePreviewCanvasProps>(
  function WorkspacePreviewCanvas({ canvasLabel }, ref) {
    return (
      <div className="relative flex min-w-0 shrink-0 flex-col bg-zinc-950/80 p-4">
        <div
          className="relative mx-auto flex w-full max-w-5xl items-start justify-center"
          aria-label={canvasLabel}
        >
          <div
            ref={ref}
            className="relative aspect-video w-full max-h-[min(52vh,520px)] min-h-[240px] overflow-hidden rounded-lg border border-white/10 bg-black ring-1 ring-white/5"
          >
            <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
              <VideoCanvas fileInputId={WORKSPACE_VIDEO_FILE_INPUT_ID} />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

WorkspacePreviewCanvas.displayName = 'WorkspacePreviewCanvas';
