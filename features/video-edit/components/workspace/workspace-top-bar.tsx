import { Redo2, Undo2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WorkspaceThemeToggle } from './workspace-theme-toggle';

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
  controlsDisabled?: boolean;
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
  controlsDisabled = false,
}: WorkspaceTopBarProps) {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-200/90 bg-white/90 px-3 py-2 backdrop-blur-sm dark:border-white/10 dark:bg-black/80 sm:px-4 lg:min-h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
      <div className="flex min-w-0 w-full items-center lg:flex-1">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/15 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/5 dark:hover:text-white"
          >
            ← Back to Home
          </Link>
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            onClick={onUndoClick}
            disabled={controlsDisabled || !canUndo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-muted transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-35 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-transparent"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            onClick={onRedoClick}
            disabled={controlsDisabled || !canRedo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-muted transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-35 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-transparent"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-start gap-2 lg:flex-1 lg:justify-center">
        {syncStatusLabel ? (
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{syncStatusLabel}</p>
        ) : null}
      </div>

      <div className="flex w-full justify-end lg:flex-1">
        <div className="flex items-center gap-2">
          <WorkspaceThemeToggle />
          <button
            type="button"
            onClick={onResetClick}
            disabled={controlsDisabled}
            className="rounded-lg border border-rose-500/45 bg-transparent px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:border-rose-500/65 hover:bg-rose-500/10 dark:text-rose-200 dark:hover:border-rose-400/50"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={onExportClick}
            disabled={controlsDisabled || exportDisabled}
            title={exportDisabled ? exportDisabledTitle : undefined}
            className="rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-violet-500/50 hover:bg-violet-500/10 disabled:pointer-events-none disabled:opacity-40 dark:border-white/20 dark:hover:border-violet-400/40"
          >
            {exportLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
