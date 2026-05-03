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
      className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-300 bg-zinc-100/90 p-1 dark:border-white/10 dark:bg-black/40"
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
                ? 'bg-white text-foreground shadow-sm ring-1 ring-zinc-300 dark:bg-white/10 dark:ring-white/15'
                : 'text-muted hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
