type Tab = { id: string; label: string };

type WorkspacePanelTabsProps = {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
};

export function WorkspacePanelTabs({ tabs, activeId, onChange, ariaLabel }: WorkspacePanelTabsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-6 border-b border-zinc-200 dark:border-white/10">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative pb-2.5 text-sm font-medium capitalize transition-colors ${
              active ? 'text-foreground' : 'text-muted hover:text-foreground/80'
            }`}
          >
            {tab.label}
            {active ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-violet-400" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
