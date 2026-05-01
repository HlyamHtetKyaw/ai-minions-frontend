'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { clearClientAuth } from '@/lib/auth-token';
import { useAuthSession } from '@/components/layout/auth-session-context';

function initials(name: string) {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

export default function HeaderSession() {
  const t = useTranslations('header');
  const router = useRouter();
  const { user, loading, setUser } = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      /* still clear client */
    }
    clearClientAuth();
    setUser(null);
    router.push('/login');
    router.refresh();
  }

  const displayName = user?.displayName?.trim() || user?.username || '';
  const points =
    typeof user?.creditBalance === 'number' ? user.creditBalance : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden h-8 w-20 animate-pulse rounded-full bg-surface lg:inline-block" />
        <span className="h-9 w-9 animate-pulse rounded-full bg-surface" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span
          className="hidden rounded-full border border-accent-gold/40 bg-accent-gold-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold lg:inline-flex"
          title={t('pointsHint')}
        >
          {t('pointsWithBalance', { count: points ?? 0 })}
        </span>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-card-border bg-surface/60 py-1 pl-1 pr-2 transition-colors hover:border-accent-gold/30 hover:bg-surface sm:pr-3"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[#0f172a] shadow-sm sm:h-9 sm:w-9 sm:text-sm"
              style={{
                background:
                  'linear-gradient(145deg, var(--accent-gold) 0%, #b8860b 100%)',
              }}
            >
              {initials(displayName)}
            </span>
            <span className="hidden max-w-[7.5rem] truncate text-left text-sm font-medium text-foreground sm:inline">
              {displayName}
            </span>
            <ChevronDown
              className={`hidden h-4 w-4 shrink-0 text-muted transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] rounded-2xl border border-card-border bg-elevated py-1 shadow-xl backdrop-blur-xl dark:border-white/10"
              role="menu"
            >
              <div className="border-b border-card-border px-3 py-2.5 sm:hidden">
                <p className="text-xs text-muted">{t('signedInAs')}</p>
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
                  {t('pointsWithBalance', { count: points ?? 0 })}
                </p>
              </div>
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface"
              >
                <User className="h-4 w-4 text-muted" />
                {t('account')}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface"
              >
                <LogOut className="h-4 w-4 text-muted" />
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="hidden shrink-0 items-center gap-1 sm:gap-2 lg:flex">
      <span
        className="hidden rounded-full border border-accent-gold/25 bg-accent-gold-muted/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold/90 lg:inline-flex"
        title={t('pointsGuestHint')}
      >
        {t('pointsGuestBadge')}
      </span>
      <Link
        href="/login"
        className="rounded-full px-2.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground sm:px-3 sm:text-sm"
      >
        {t('signIn')}
      </Link>
      <Link
        href="/signup"
        className="rounded-full bg-primary px-2.5 py-2 text-xs font-medium text-primary-fg transition-colors hover:bg-primary-hover sm:px-3 sm:text-sm"
      >
        {t('signUp')}
      </Link>
    </div>
  );
}
