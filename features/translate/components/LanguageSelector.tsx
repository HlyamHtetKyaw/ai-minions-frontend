'use client';

type Props = {
  label: string;
  value: string;
  options: { code: string; name: string }[];
  onChange: (value: string) => void;
};

export default function LanguageSelector({ label, value, options, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
}
