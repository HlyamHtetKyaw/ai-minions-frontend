import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_HINT_COOKIE } from '@/lib/auth-token';
import { VerifiedUserShell } from '@/features/auth/verified-user-shell';

// HttpOnly cookies from API + client hint set after login (see lib/auth-token.ts).
const AUTH_COOKIE_NAMES = [
  SESSION_HINT_COOKIE,
  'access_token',
  'refresh_token',
  'session',
  'token',
  'auth',
];

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isAuthenticated = AUTH_COOKIE_NAMES.some((name) => cookieStore.has(name));

  if (!isAuthenticated) {
    redirect('/login');
  }

  return <VerifiedUserShell>{children}</VerifiedUserShell>;
}
