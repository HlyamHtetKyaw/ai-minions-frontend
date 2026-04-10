'use client';

import { Link as NavLink, usePathname } from '@/i18n/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { FEATURES } from '@/features';
import { useAuthSession } from '@/components/layout/auth-session-context';

export type HeaderNavLabels = {
  toolsLabel: string;
  homeLabel: string;
  workspaceLabel: string;
  pricingLabel: string;
};

export function HeaderDesktopNav({
  toolsLabel,
  homeLabel,
  workspaceLabel,
  pricingLabel,
}: HeaderNavLabels) {
  const pathname = usePathname();
  const tFeatures = useTranslations('features');

  const isHome = pathname === '/';
  const isWorkspace = pathname === '/tools';
  const isPricing = pathname === '/pricing';

  const navLinkDesktop = (active: boolean) =>
    `rounded-full px-2.5 py-2 text-sm font-medium transition-colors lg:px-4 ${
      active ? 'bg-nav-pill text-foreground shadow-sm' : 'text-muted hover:text-foreground'
    }`;

  return (
    <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 px-1 sm:px-2 lg:flex lg:gap-1 lg:px-3">
      <NavLink href="/" className={navLinkDesktop(isHome)}>
        {homeLabel}
      </NavLink>

      <NavLink href="/tools" className={navLinkDesktop(isWorkspace)}>
        {workspaceLabel}
      </NavLink>

      <NavLink href="/pricing" className={navLinkDesktop(isPricing)}>
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
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-surface"
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

export function HeaderMobileNav({
  toolsLabel,
  homeLabel,
  workspaceLabel,
  pricingLabel,
}: HeaderNavLabels) {
  const pathname = usePathname();
  const tFeatures = useTranslations('features');
  const tHeader = useTranslations('header');
  const { user, loading } = useAuthSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const isHome = pathname === '/';
  const isWorkspace = pathname === '/tools';
  const isPricing = pathname === '/pricing';

  useEffect(() => {
    setMobileOpen(false);
    setToolsExpanded(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navLinkMobile = (active: boolean) =>
    `block rounded-xl px-4 py-3 text-base font-medium transition-colors ${
      active ? 'bg-nav-pill text-foreground' : 'text-muted hover:bg-surface hover:text-foreground'
    }`;

  return (
    <>
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass/60 text-foreground backdrop-blur-sm transition-colors hover:bg-glass lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="site-mobile-nav"
        aria-label={tHeader('openMenu')}
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-[2px] lg:hidden"
            aria-label={tHeader('closeMenu')}
            onClick={() => setMobileOpen(false)}
          />

          <div
            id="site-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
            className="fixed left-3 right-3 top-[4.5rem] z-[120] max-h-[min(72vh,calc(100dvh-6rem))] overflow-y-auto rounded-2xl border border-card-border bg-card/95 p-2 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:bg-[rgba(10,15,30,0.92)] lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-card-border px-2 py-2">
              <span
                id="mobile-nav-title"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted"
              >
                {tHeader('navigationLabel')}
              </span>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
                aria-label={tHeader('closeMenu')}
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5 p-1 pt-2">
              <NavLink href="/" className={navLinkMobile(isHome)} onClick={() => setMobileOpen(false)}>
                {homeLabel}
              </NavLink>
              <NavLink
                href="/tools"
                className={navLinkMobile(isWorkspace)}
                onClick={() => setMobileOpen(false)}
              >
                {workspaceLabel}
              </NavLink>
              <NavLink
                href="/pricing"
                className={navLinkMobile(isPricing)}
                onClick={() => setMobileOpen(false)}
              >
                {pricingLabel}
              </NavLink>

              <div className="mt-1 border-t border-card-border pt-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                  aria-expanded={toolsExpanded}
                  onClick={() => setToolsExpanded((v) => !v)}
                >
                  {toolsLabel}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${toolsExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {toolsExpanded ? (
                  <div className="mt-1 ml-3 flex flex-col gap-0.5 border-l-2 border-accent-gold/30 pl-3">
                    {FEATURES.map((f) => {
                      const Icon = f.icon;
                      return (
                        <NavLink
                          key={f.key}
                          href={f.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-surface"
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted" />
                          <span className="font-medium">{tFeatures(`${f.key}.name`)}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {!loading && !user ? (
                <div className="mt-2 border-t border-card-border pt-3">
                  <NavLink
                    href="/login"
                    className="block rounded-xl px-4 py-3 text-base font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {tHeader('signIn')}
                  </NavLink>
                  <NavLink
                    href="/signup"
                    className="mt-1 block rounded-xl bg-primary px-4 py-3 text-center text-base font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
                    onClick={() => setMobileOpen(false)}
                  >
                    {tHeader('signUp')}
                  </NavLink>
                </div>
              ) : null}
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
