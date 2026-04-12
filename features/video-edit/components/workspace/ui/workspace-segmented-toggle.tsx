type Option<T extends string> = { id: T; label: string };

type WorkspaceSegmentedToggleProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
};

export function WorkspaceSegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: WorkspaceSegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1"
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? 'bg-white/10 text-foreground ring-1 ring-white/15'
                : 'text-muted hover:bg-white/5 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
