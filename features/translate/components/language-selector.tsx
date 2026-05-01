'use client';

import { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  options: { code: string; name: string }[];
  onChange: (value: string) => void;
};

export default function LanguageSelector({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentName = options.find((o) => o.code === value)?.name ?? value;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-glass-border bg-glass/80 px-2.5 py-2 backdrop-blur-sm transition-colors hover:bg-glass sm:gap-3 sm:px-3"
      >
        <Languages
          className="hidden h-8 w-8 shrink-0 rounded-lg bg-foreground/10 p-1.5 text-foreground sm:block"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">
            {label}
          </span>
          <span className="truncate text-sm font-medium text-foreground" title={currentName}>
            {currentName}
          </span>
        </div>
        <ChevronDown
          className={`ml-1 h-4 w-4 shrink-0 text-foreground/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-card-border bg-elevated shadow-lg backdrop-blur-sm">
          {options.map((opt) => (
            <li key={opt.code}>
              <button
                type="button"
                onClick={() => { onChange(opt.code); setOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-foreground/10 ${
                  opt.code === value ? 'text-violet-400' : 'text-foreground'
                }`}
              >
                {opt.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
