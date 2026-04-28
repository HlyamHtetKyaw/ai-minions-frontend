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
  /** True while the preview wrapper is the fullscreen element. */
  isFullscreen?: boolean;
};

/** `ref` targets the framed preview (used for fullscreen from the timeline). */
export const WorkspacePreviewCanvas = forwardRef<HTMLDivElement, WorkspacePreviewCanvasProps>(
  function WorkspacePreviewCanvas(
    { canvasLabel, aspect, skipInitialCanvasSizeStep = false, isFullscreen = false },
    ref,
  ) {
    const frameStyle = useMemo(
      () =>
        getWorkspacePreviewFrameStyle(
          aspect,
          isFullscreen ? { maxHeight: 'min(92dvh, 920px)' } : undefined,
        ),
      [aspect, isFullscreen],
    );

    return (
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          isFullscreen ? 'h-full w-full bg-black p-0' : 'bg-zinc-950/80 p-2 sm:p-4'
        }`}
      >
        <div
          ref={ref}
          className={`relative mx-auto flex justify-center ${
            isFullscreen ? 'h-full w-full max-w-none items-center' : 'w-full max-w-5xl'
          }`}
          aria-label={canvasLabel}
        >
          <div
            className="relative mx-auto min-h-0 overflow-hidden rounded-lg border border-white/10 bg-black ring-1 ring-white/5 transition-[width,height,aspect-ratio] duration-300 ease-out"
            style={frameStyle}
          >
            <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
              <VideoCanvas
                fileInputId={WORKSPACE_VIDEO_FILE_INPUT_ID}
                objectFit="contain"
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
