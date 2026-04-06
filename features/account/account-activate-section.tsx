'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { activateMemberLevelCode } from '@/lib/account';
import { fetchMe } from '@/lib/auth';
import { AUTH_CHANGED_EVENT } from '@/lib/auth-token';

type Props = {
  onActivated: (credits: number) => void;
};

export function AccountActivateSection({ onActivated }: Props) {
  const t = useTranslations('account');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await activateMemberLevelCode(trimmed);
      setCode('');
      const me = await fetchMe();
      if (me && typeof me.creditBalance === 'number') {
        onActivated(me.creditBalance);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      }
      setSuccess(t('activateSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('activateError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-card-border bg-card/50 p-6 sm:p-8"
      aria-labelledby="activate-heading"
    >
      <div className="border-l-2 border-accent-gold pl-4">
        <h2
          id="activate-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          {t('activateTitle')}
        </h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          {t('activateSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
          <label className="sr-only" htmlFor="member-level-code">
            {t('activateLabel')}
          </label>
          <input
            id="member-level-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('activatePlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            className="min-h-[2.75rem] flex-1 rounded-xl border border-card-border bg-background px-3 py-2.5 font-mono text-sm tracking-wide text-foreground placeholder:text-muted/80 outline-none transition-shadow focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/20"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="shrink-0 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-fg transition-opacity hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[7.5rem]"
          >
            {loading ? t('activateSubmitting') : t('activateSubmit')}
          </button>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-400"
            role="status"
          >
            {success}
          </p>
        ) : null}
      </form>
    </section>
  );
}
