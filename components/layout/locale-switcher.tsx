'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTransition, useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { LANGUAGES } from '@/lib/constants';

export default function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLanguage = LANGUAGES.find((l) => l.code === locale)?.name ?? 'English';

  function handleSelect(code: string) {
    setOpen(false);
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  }

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative" aria-label={label}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-glass-border bg-glass/80 px-2 py-1.5 backdrop-blur-sm transition-colors hover:bg-glass lg:gap-3 lg:px-3 lg:py-2"
        aria-label={`${label}: ${currentLanguage}`}
      >
        <Globe className="h-5 w-5 shrink-0 rounded-lg bg-foreground/10 p-1 text-foreground lg:h-8 lg:w-8 lg:p-1.5" />
        <div className="hidden flex-col leading-tight text-left lg:flex">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">
            Language
          </span>
          <span className="text-sm font-medium text-foreground">{currentLanguage}</span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-foreground/60 transition-transform duration-200 lg:ml-1 lg:h-4 lg:w-4 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul className="absolute right-0 z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-glass-border bg-card shadow-lg backdrop-blur-sm">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => handleSelect(l.code)}
                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-foreground/10 ${
                  l.code === locale ? 'text-violet-400' : 'text-foreground'
                }`}
              >
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
