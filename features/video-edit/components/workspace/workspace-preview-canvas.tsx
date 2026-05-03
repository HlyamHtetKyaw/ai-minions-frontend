'use client';

import { forwardRef, useMemo } from 'react';
import { VideoCanvas } from '@/components/editor/VideoCanvas';
import type { WorkspaceAspectId } from './workspace-top-bar';
import {
  getWorkspacePreviewFrameStyle,
  type WorkspacePreviewFrameFill,
} from './workspace-preview-frame-style';

export const WORKSPACE_VIDEO_FILE_INPUT_ID = 'workspace-video-file-input';

type WorkspacePreviewCanvasProps = {
  canvasLabel: string;
  aspect: WorkspaceAspectId;
  /** When true, canvas size is chosen in the workspace shell first (Canva-style). */
  skipInitialCanvasSizeStep?: boolean;
  /** True while the preview wrapper is the fullscreen element. */
  isFullscreen?: boolean;
  /** Measured preview pane; when set with positive size, frame uses container fit instead of dvh. */
  previewFill?: WorkspacePreviewFrameFill | null;
};

/** `ref` targets the framed preview (used for fullscreen from the timeline). */
export const WorkspacePreviewCanvas = forwardRef<HTMLDivElement, WorkspacePreviewCanvasProps>(
  function WorkspacePreviewCanvas(
    {
      canvasLabel,
      aspect,
      skipInitialCanvasSizeStep = false,
      isFullscreen = false,
      previewFill = null,
    },
    ref,
  ) {
    const frameStyle = useMemo(
      () =>
        getWorkspacePreviewFrameStyle(aspect, {
          maxHeight: isFullscreen ? 'min(92dvh, 920px)' : undefined,
          fillContainer: isFullscreen ? null : previewFill,
        }),
      [aspect, isFullscreen, previewFill],
    );

    return (
      <div
        className={`relative flex min-w-0 flex-col ${
          isFullscreen
            ? 'h-full min-h-0 flex-1 overflow-hidden bg-black p-0'
            : 'flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden bg-zinc-200/70 dark:bg-zinc-950/80'
        }`}
      >
        {/* Artboard: fills preview pane and shrinks when the timeline is tall; video stays letterboxed inside. */}
        <div
          ref={ref}
          className={`relative box-border flex min-h-0 min-w-0 w-full max-w-full flex-1 items-center justify-center ${
            isFullscreen ? 'h-full' : 'h-full px-1 py-2 sm:px-2 sm:py-3'
          }`}
          aria-label={canvasLabel}
        >
          <div
            className="relative max-h-full max-w-full min-h-0 min-w-0 shrink-0 overflow-hidden rounded-lg border border-zinc-400/35 bg-black ring-1 ring-zinc-500/25 transition-[width,height,aspect-ratio] duration-300 ease-out dark:border-white/10 dark:ring-white/5"
            style={frameStyle}
          >
            <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
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
