'use client';

import { Link as NavLink, usePathname } from '@/i18n/navigation';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FEATURES } from '@/features';

type Props = {
  toolsLabel: string;
  homeLabel: string;
};

export default function HeaderClient({ toolsLabel, homeLabel }: Props) {
  const pathname = usePathname();
  const tFeatures = useTranslations('features');
  const isHome = pathname === '/';

  return (
    <nav className="hidden md:flex flex-1 items-center justify-center gap-1 px-4">
      <NavLink
        href="/"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          isHome ? 'bg-nav-pill text-foreground shadow-sm' : 'text-muted hover:text-foreground'
        }`}
      >
        {homeLabel}
      </NavLink>

      <div className="group relative">
        <button
          type="button"
          className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          {toolsLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>

        <div className="invisible z-50 opacity-0 group-hover:visible group-hover:opacity-100 absolute left-1/2 top-full mt-2 w-72 -translate-x-1/2 rounded-2xl glass-panel p-2 shadow-xl transition-all duration-150">
          <div className="grid max-h-96 grid-cols-1 gap-0.5 overflow-y-auto">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <NavLink
                  key={f.key}
                  href={f.href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-surface transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted" />
                  <span className="font-medium">{tFeatures(`${f.key}.name`)}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
