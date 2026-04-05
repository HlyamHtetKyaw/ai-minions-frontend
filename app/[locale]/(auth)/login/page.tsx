'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usernameOrEmail, password);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back to AI Minions</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-card-border bg-card p-6 shadow-sm space-y-4"
        >
          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="usernameOrEmail" className="text-sm font-medium text-foreground">
              Username or email
            </label>
            <input
              id="usernameOrEmail"
              type="text"
              required
              autoComplete="username"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-accent-gold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
