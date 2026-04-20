'use client';

import { forwardRef } from 'react';
import { VideoCanvas } from '@/components/editor/VideoCanvas';
import type { WorkspaceAspectId } from './workspace-top-bar';

export const WORKSPACE_VIDEO_FILE_INPUT_ID = 'workspace-video-file-input';

type WorkspacePreviewCanvasProps = {
  canvasLabel: string;
  aspect: WorkspaceAspectId;
};

const ASPECT_RATIO_VALUE: Record<WorkspaceAspectId, string> = {
  '16:9': '16 / 9',
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '4:3': '4 / 3',
};

/** `ref` targets the framed preview (used for fullscreen from the timeline). */
export const WorkspacePreviewCanvas = forwardRef<HTMLDivElement, WorkspacePreviewCanvasProps>(
  function WorkspacePreviewCanvas({ canvasLabel, aspect }, ref) {
    return (
      <div className="relative flex min-w-0 shrink-0 flex-col bg-zinc-950/80 p-2 sm:p-4">
        <div
          className="relative mx-auto flex w-full max-w-5xl items-start justify-center"
          aria-label={canvasLabel}
        >
          <div
            ref={ref}
            className="relative w-full max-h-[min(52vh,520px)] min-h-[180px] overflow-hidden rounded-lg border border-white/10 bg-black ring-1 ring-white/5 sm:min-h-[240px]"
            style={{ aspectRatio: ASPECT_RATIO_VALUE[aspect] }}
          >
            <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
              <VideoCanvas fileInputId={WORKSPACE_VIDEO_FILE_INPUT_ID} objectFit="cover" />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

WorkspacePreviewCanvas.displayName = 'WorkspacePreviewCanvas';
