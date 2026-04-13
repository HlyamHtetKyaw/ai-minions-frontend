import { ChevronLeft, Redo2, Undo2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WorkspaceSegmentedToggle } from './ui';

export type WorkspaceAspectId = '16:9' | '9:16' | '1:1' | '4:3';

type WorkspaceTopBarProps = {
  returnToDashboardLabel: string;
  aspect: WorkspaceAspectId;
  onAspectChange: (id: WorkspaceAspectId) => void;
  aspectOptions: { id: WorkspaceAspectId; label: string }[];
  aspectToggleAriaLabel: string;
  exportLabel: string;
  onExportClick?: () => void;
  onUndoClick?: () => void;
  onRedoClick?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

export function WorkspaceTopBar({
  returnToDashboardLabel,
  aspect,
  onAspectChange,
  aspectOptions,
  aspectToggleAriaLabel,
  exportLabel,
  onExportClick,
  onUndoClick,
  onRedoClick,
  canUndo = false,
  canRedo = false,
}: WorkspaceTopBarProps) {
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center">
        <Link
          href="/video-edit"
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="truncate">{returnToDashboardLabel}</span>
        </Link>
        <div className="ml-2 flex items-center gap-1">
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

      <div className="flex flex-1 justify-center">
        <WorkspaceSegmentedToggle
          ariaLabel={aspectToggleAriaLabel}
          options={aspectOptions}
          value={aspect}
          onChange={onAspectChange}
        />
      </div>

      <div className="flex flex-1 justify-end">
        <button
          type="button"
          onClick={onExportClick}
          className="rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-violet-400/40 hover:bg-violet-500/10"
        >
          {exportLabel}
        </button>
      </div>
    </header>
  );
}
