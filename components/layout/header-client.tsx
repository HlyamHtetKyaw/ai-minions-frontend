'use client';

import { Link as NavLink, usePathname } from '@/i18n/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuthSession } from '@/components/layout/auth-session-context';

export type HeaderNavLabels = {
  homeLabel: string;
  workspaceLabel: string;
  pricingLabel: string;
};

export function HeaderDesktopNav({
  homeLabel,
  workspaceLabel,
  pricingLabel,
}: HeaderNavLabels) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isWorkspace = pathname === '/tools';
  const isPricing = pathname === '/pricing';

  const navLinkDesktop = (active: boolean) =>
    `rounded-full px-2.5 py-2 text-sm font-medium transition-colors lg:px-4 ${
      active ? 'bg-nav-pill text-foreground shadow-sm' : 'text-muted hover:text-foreground'
    }`;

  return (
    <nav className="hidden min-w-0 items-center justify-center gap-0.5 px-1 sm:px-2 lg:flex lg:gap-1 lg:px-3">
      <NavLink href="/" className={navLinkDesktop(isHome)}>
        {homeLabel}
      </NavLink>

      <NavLink href="/tools" className={navLinkDesktop(isWorkspace)}>
        {workspaceLabel}
      </NavLink>

      <NavLink href="/pricing" className={navLinkDesktop(isPricing)}>
        {pricingLabel}
      </NavLink>
    </nav>
  );
}

export function HeaderMobileNav({
  homeLabel,
  workspaceLabel,
  pricingLabel,
}: HeaderNavLabels) {
  const pathname = usePathname();
  const tHeader = useTranslations('header');
  const { user, loading, signOut } = useAuthSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);

  const isHome = pathname === '/';
  const isWorkspace = pathname === '/tools';
  const isPricing = pathname === '/pricing';

  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setMobileOpen(false);
  }

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
            className="fixed inset-0 z-110 bg-black/45 backdrop-blur-[2px] lg:hidden"
            aria-label={tHeader('closeMenu')}
            onClick={() => setMobileOpen(false)}
          />

          <div
            id="site-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
            className="fixed left-3 right-3 top-18 z-120 max-h-[min(72vh,calc(100dvh-6rem))] overflow-y-auto rounded-2xl border border-card-border bg-elevated/95 p-2 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:bg-[rgba(10,15,30,0.92)] lg:hidden"
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

              {!loading && user ? (
                <div className="mt-2 border-t border-card-border pt-3">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-base font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => {
                      setMobileOpen(false);
                      void signOut();
                    }}
                  >
                    <LogOut className="h-5 w-5 shrink-0" aria-hidden />
                    {tHeader('logout')}
                  </button>
                </div>
              ) : null}
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
