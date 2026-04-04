'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { LANGUAGES } from '@/lib/constants';
import { useTransition } from 'react';

export default function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(() => {
      router.replace(pathname, { locale: e.target.value });
    });
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="rounded-full border border-glass-border bg-glass/80 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/30"
      aria-label={label}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
