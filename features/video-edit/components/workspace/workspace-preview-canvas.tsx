'use client';

import { forwardRef, useMemo } from 'react';
import { VideoCanvas } from '@/components/editor/VideoCanvas';
import type { WorkspaceAspectId } from './workspace-top-bar';
import { getWorkspacePreviewFrameStyle } from './workspace-preview-frame-style';

export const WORKSPACE_VIDEO_FILE_INPUT_ID = 'workspace-video-file-input';

type WorkspacePreviewCanvasProps = {
  canvasLabel: string;
  aspect: WorkspaceAspectId;
  /** When true, canvas size is chosen in the workspace shell first (Canva-style). */
  skipInitialCanvasSizeStep?: boolean;
};

/** `ref` targets the framed preview (used for fullscreen from the timeline). */
export const WorkspacePreviewCanvas = forwardRef<HTMLDivElement, WorkspacePreviewCanvasProps>(
  function WorkspacePreviewCanvas({ canvasLabel, aspect, skipInitialCanvasSizeStep = false }, ref) {
    const frameStyle = useMemo(() => getWorkspacePreviewFrameStyle(aspect), [aspect]);

    return (
      <div className="relative flex min-w-0 shrink-0 flex-col bg-zinc-950/80 p-2 sm:p-4">
        <div
          className="relative mx-auto flex w-full max-w-5xl justify-center"
          aria-label={canvasLabel}
        >
          <div
            ref={ref}
            className="relative mx-auto min-h-0 overflow-hidden rounded-lg border border-white/10 bg-black ring-1 ring-white/5 transition-[width,height,aspect-ratio] duration-300 ease-out"
            style={frameStyle}
          >
            <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
              <VideoCanvas
                fileInputId={WORKSPACE_VIDEO_FILE_INPUT_ID}
                objectFit="cover"
                skipInitialCanvasSizeStep={skipInitialCanvasSizeStep}
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

WorkspacePreviewCanvas.displayName = 'WorkspacePreviewCanvas';
