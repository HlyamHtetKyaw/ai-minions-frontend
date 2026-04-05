interface TextPanelsProps {
  sourceLabel: string;
  sourceValue: string;
  sourcePlaceholder: string;
  onSourceChange: (value: string) => void;
  translatedLabel: string;
  translatedValue: string;
  translatedPlaceholder: string;
  rows?: number;
}

export default function TextPanels({
  sourceLabel,
  sourceValue,
  sourcePlaceholder,
  onSourceChange,
  translatedLabel,
  translatedValue,
  translatedPlaceholder,
  rows = 8,
}: TextPanelsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">{sourceLabel}</label>
        <textarea
          value={sourceValue}
          onChange={(e) => onSourceChange(e.target.value)}
          placeholder={sourcePlaceholder}
          rows={rows}
          className="resize-none rounded-xl border border-card-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">{translatedLabel}</label>
        <textarea
          value={translatedValue}
          readOnly
          placeholder={translatedPlaceholder}
          rows={rows}
          className="resize-none rounded-xl border border-card-border bg-subtle px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
      </div>
    </div>
  );
}
