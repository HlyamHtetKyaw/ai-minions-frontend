'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Props = {
  signInLabel: string;
  signUpLabel: string;
  logoutLabel: string;
};

export default function HeaderAuth({ signInLabel, signUpLabel, logoutLabel }: Props) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // ignore errors — clear client state regardless
    }
    router.push('/login');
    router.refresh();
  }

  // TODO: replace with real session check once a /me or session endpoint is available
  const isLoggedIn = false;

  if (isLoggedIn) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        {logoutLabel}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/login"
        className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        {signInLabel}
      </Link>
      <Link
        href="/signup"
        className="rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
      >
        {signUpLabel}
      </Link>
    </div>
  );
}
