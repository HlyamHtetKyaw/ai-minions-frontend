import {
  WorkspacePanelNumberField,
  WorkspacePanelSlider,
} from './ui';

type WorkspacePropertiesPanelProps = {
  titleLabel: string;
  fontLabel: string;
  positionSectionLabel: string;
  x: string;
  y: string;
  w: string;
  h: string;
  onPositionChange: (key: 'x' | 'y' | 'w' | 'h', v: string) => void;
  opacityLabel: string;
  opacityPct: number;
  onOpacityChange: (n: number) => void;
  timingSectionLabel: string;
  inLabel: string;
  outLabel: string;
  timeIn: string;
  timeOut: string;
  onTimingChange: (key: 'in' | 'out', v: string) => void;
  deleteLabel: string;
  onDelete?: () => void;
};

const SWATCHES = ['#fafafa', '#c4b5fd', '#86efac', '#fdba74', '#fef08a'] as const;

export function WorkspacePropertiesPanel({
  titleLabel,
  fontLabel,
  positionSectionLabel,
  x,
  y,
  w,
  h,
  onPositionChange,
  opacityLabel,
  opacityPct,
  onOpacityChange,
  timingSectionLabel,
  inLabel,
  outLabel,
  timeIn,
  timeOut,
  onTimingChange,
  deleteLabel,
  onDelete,
}: WorkspacePropertiesPanelProps) {
  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-l border-white/10 bg-black/70 md:w-72 md:min-w-72 md:max-w-72">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{titleLabel}</h2>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{fontLabel}</p>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground">
            Pyidaungsu (default)
          </div>
        </div>

        <div className="flex gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className="h-7 w-7 rounded-md border border-white/10 ring-offset-2 ring-offset-black transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {positionSectionLabel}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <WorkspacePanelNumberField
              id="pos-x"
              label="X"
              value={x}
              onChange={(e) => onPositionChange('x', e.target.value)}
            />
            <WorkspacePanelNumberField
              id="pos-y"
              label="Y"
              value={y}
              onChange={(e) => onPositionChange('y', e.target.value)}
            />
            <WorkspacePanelNumberField
              id="pos-w"
              label="W"
              value={w}
              onChange={(e) => onPositionChange('w', e.target.value)}
            />
            <WorkspacePanelNumberField
              id="pos-h"
              label="H"
              value={h}
              onChange={(e) => onPositionChange('h', e.target.value)}
            />
          </div>
        </div>

        <WorkspacePanelSlider
          id="opacity"
          label={opacityLabel}
          valueLabel={`${opacityPct}%`}
          min={0}
          max={100}
          value={opacityPct}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
        />

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {timingSectionLabel}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <WorkspacePanelNumberField
              id="time-in"
              label={inLabel}
              value={timeIn}
              step={0.1}
              onChange={(e) => onTimingChange('in', e.target.value)}
            />
            <WorkspacePanelNumberField
              id="time-out"
              label={outLabel}
              value={timeOut}
              step={0.1}
              onChange={(e) => onTimingChange('out', e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="mt-auto w-full rounded-lg border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
        >
          {deleteLabel}
        </button>
      </div>
    </aside>
  );
}
