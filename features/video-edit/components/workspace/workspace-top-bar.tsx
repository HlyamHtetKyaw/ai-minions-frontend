import { Redo2, Undo2 } from 'lucide-react';

export type WorkspaceAspectId = '16:9' | '9:16' | '1:1' | '4:3';

type WorkspaceTopBarProps = {
  exportLabel: string;
  /** When true, export is blocked (e.g. video is still a local blob: URL). */
  exportDisabled?: boolean;
  exportDisabledTitle?: string;
  resetLabel?: string;
  onExportClick?: () => void;
  onResetClick?: () => void;
  onUndoClick?: () => void;
  onRedoClick?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  syncStatusLabel?: string;
};

export function WorkspaceTopBar({
  exportLabel,
  exportDisabled = false,
  exportDisabledTitle,
  resetLabel = 'Reset',
  onExportClick,
  onResetClick,
  onUndoClick,
  onRedoClick,
  canUndo = false,
  canRedo = false,
  syncStatusLabel,
}: WorkspaceTopBarProps) {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-white/10 bg-black/80 px-3 py-2 backdrop-blur-sm sm:px-4 lg:min-h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
      <div className="flex min-w-0 w-full items-center lg:flex-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            onClick={onUndoClick}
            disabled={!canUndo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted transition-colors hover:border-white/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            onClick={onRedoClick}
            disabled={!canRedo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted transition-colors hover:border-white/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex w-full items-center justify-start lg:flex-1 lg:justify-center">
        {syncStatusLabel ? (
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">{syncStatusLabel}</p>
        ) : null}
      </div>

      <div className="flex w-full justify-end lg:flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetClick}
            className="rounded-lg border border-rose-500/30 bg-transparent px-3 py-2 text-sm font-medium text-rose-200 transition-colors hover:border-rose-400/50 hover:bg-rose-500/10"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={onExportClick}
            disabled={exportDisabled}
            title={exportDisabled ? exportDisabledTitle : undefined}
            className="rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-violet-400/40 hover:bg-violet-500/10 disabled:pointer-events-none disabled:opacity-40"
          >
            {exportLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
