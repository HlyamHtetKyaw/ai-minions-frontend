'use client';

import { Link as NavLink, usePathname } from '@/i18n/navigation';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FEATURES } from '@/features';

type Props = {
  toolsLabel: string;
  homeLabel: string;
  workspaceLabel: string;
  pricingLabel: string;
};

export default function HeaderClient({
  toolsLabel,
  homeLabel,
  workspaceLabel,
  pricingLabel,
}: Props) {
  const pathname = usePathname();
  const tFeatures = useTranslations('features');
  const isHome = pathname === '/';
  const isWorkspace = pathname === '/tools';
  const isPricing = pathname === '/pricing';

  return (
    <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 px-1 sm:px-2 md:flex lg:gap-1 lg:px-3">
      <NavLink
        href="/"
        className={`rounded-full px-2.5 py-2 text-sm font-medium transition-colors lg:px-4 ${
          isHome ? 'bg-nav-pill text-foreground shadow-sm' : 'text-muted hover:text-foreground'
        }`}
      >
        {homeLabel}
      </NavLink>

      <NavLink
        href="/tools"
        className={`rounded-full px-2.5 py-2 text-sm font-medium transition-colors lg:px-4 ${
          isWorkspace ? 'bg-nav-pill text-foreground shadow-sm' : 'text-muted hover:text-foreground'
        }`}
      >
        {workspaceLabel}
      </NavLink>

      <NavLink
        href="/pricing"
        className={`rounded-full px-2.5 py-2 text-sm font-medium transition-colors lg:px-4 ${
          isPricing ? 'bg-nav-pill text-foreground shadow-sm' : 'text-muted hover:text-foreground'
        }`}
      >
        {pricingLabel}
      </NavLink>

      <div className="group/menu relative z-10 hover:z-[300] focus-within:z-[300]">
        <button
          type="button"
          className="flex items-center gap-1 rounded-full px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground lg:px-4"
        >
          {toolsLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>

        <div
          className="pointer-events-none invisible absolute left-1/2 top-full z-[400] mt-2 w-72 -translate-x-1/2 opacity-0 transition-all duration-150 group-hover/menu:pointer-events-auto group-hover/menu:visible group-hover/menu:opacity-100 rounded-2xl border border-card-border bg-background p-2 shadow-[0_24px_64px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.06] dark:shadow-[0_28px_80px_rgba(0,0,0,0.85)] dark:ring-white/[0.12]"
          role="menu"
        >
          <div className="grid max-h-96 grid-cols-1 gap-0.5 overflow-y-auto">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <NavLink
                  key={f.key}
                  href={f.href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
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
