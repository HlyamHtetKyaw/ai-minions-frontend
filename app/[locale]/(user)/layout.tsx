import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// Cookie name(s) the backend sets on login — must match middleware.ts
const AUTH_COOKIE_NAMES = ['session', 'token', 'auth'];

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isAuthenticated = AUTH_COOKIE_NAMES.some((name) => cookieStore.has(name));

  if (!isAuthenticated) {
    redirect('/login');
  }

  return <>{children}</>;
}
