'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/components/layout/auth-session-context';
import ProgressBar from '@/components/shared/components/progress-bar';
import { fetchUsageHistory, type UsageHistoryItem } from '@/lib/account';
import { resolveUsageHistoryFeatureLabel } from '@/features/account/usage-history-feature-label';
import {
  openGenerationJobSseStream,
  parseGenerationSseProgressPayload,
} from '@/lib/generation-job-sse';

const COUNT_POLL_MS = 45_000;
const MODAL_REFRESH_MS = 25_000;

export default function PendingUsageHistoryTrigger() {
  const { user } = useAuthSession();
  const tHeader = useTranslations('header');
  const tAccount = useTranslations('account');
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [rows, setRows] = useState<UsageHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingProgress, setPendingProgress] = useState<Record<number, { percent: number; label: string }>>(
    {},
  );

  const streamAbortsRef = useRef<Map<number, () => void>>(new Map());
  const sseSubscribedIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const page = await fetchUsageHistory({ page: 0, size: 1, pendingOnly: true });
        if (cancelled) return;
        const n = typeof page.totalItems === 'number' ? Number(page.totalItems) : 0;
        setPendingCount(Number.isFinite(n) ? n : 0);
      } catch {
        if (!cancelled) setPendingCount(0);
      }
    };
    void tick();
    const id = window.setInterval(tick, COUNT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const page = await fetchUsageHistory({ page: 0, size: 50, pendingOnly: true });
        if (cancelled) return;
        setRows(Array.isArray(page.content) ? page.content : []);
        const n =
          typeof page.totalItems === 'number' ? Number(page.totalItems) : (page.content?.length ?? 0);
        setPendingCount(Number.isFinite(n) ? n : 0);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : tAccount('usageHistory.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(load, MODAL_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, tAccount]);

  useEffect(() => {
    if (!open) {
      streamAbortsRef.current.forEach((abort) => abort());
      streamAbortsRef.current.clear();
      sseSubscribedIdsRef.current.clear();
      setPendingProgress({});
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || rows.length === 0) return;

    rows.forEach((row) => {
      if (String(row.status ?? '').toUpperCase() !== 'PENDING') return;

      const generationId = Number(row.id);
      if (!Number.isFinite(generationId) || generationId <= 0) return;
      if (sseSubscribedIdsRef.current.has(generationId)) return;
      sseSubscribedIdsRef.current.add(generationId);

      setPendingProgress((prev) => {
        if (prev[generationId]) return prev;
        return {
          ...prev,
          [generationId]: {
            percent: 8,
            label: tAccount('usageHistory.pendingQueued'),
          },
        };
      });

      const abort = openGenerationJobSseStream(generationId, {
        onStatus: (raw) => {
          const parsed = parseGenerationSseProgressPayload(raw, {
            subscribedLabel: tAccount('usageHistory.pendingSubscribed'),
          });
          if (!parsed) return;
          setPendingProgress((prev) => ({
            ...prev,
            [generationId]: {
              percent: Math.max(prev[generationId]?.percent ?? 0, parsed.percent),
              label: parsed.label,
            },
          }));
        },
        onDone: () => {
          streamAbortsRef.current.delete(generationId);
        },
        onError: (msg) => {
          sseSubscribedIdsRef.current.delete(generationId);
          streamAbortsRef.current.delete(generationId);
          setPendingProgress((prev) => ({
            ...prev,
            [generationId]: {
              percent: prev[generationId]?.percent ?? 10,
              label: msg || tAccount('usageHistory.loadError'),
            },
          }));
        },
        onTerminal: () => {
          sseSubscribedIdsRef.current.delete(generationId);
          streamAbortsRef.current.delete(generationId);
          setRows((prev) => prev.filter((item) => item.id !== generationId));
          setPendingCount((c) => Math.max(0, c - 1));
          setPendingProgress((prev) => {
            const next = { ...prev };
            delete next[generationId];
            return next;
          });
        },
      });
      streamAbortsRef.current.set(generationId, abort);
    });
  }, [open, rows, tAccount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;

  function formatWhen(raw: string): string {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return (
    <>
      <button
        type="button"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-card-border bg-surface/60 text-foreground transition-colors hover:border-accent-gold/30 hover:bg-surface"
        aria-label={tHeader('pendingJobsAriaClock')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Clock className="h-4 w-4 opacity-90" aria-hidden />
        {pendingCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-fg">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-200 flex items-end justify-center p-4 pb-8 pt-16 backdrop-blur-sm sm:items-center sm:p-8"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-jobs-heading"
            className="max-h-[min(70vh,520px)] w-full max-w-lg overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-card-border px-4 py-3 sm:px-5">
              <h2 id="pending-jobs-heading" className="text-base font-semibold text-foreground">
                {tHeader('pendingJobsTitle')}
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {tHeader('pendingJobsClose')}
              </button>
            </div>

            <div className="max-h-[min(58vh,440px)] overflow-y-auto px-4 py-3 sm:px-5">
              {error ? (
                <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              {loading && rows.length === 0 ? (
                <div className="space-y-2 py-2">
                  <div className="h-10 animate-pulse rounded-lg bg-surface" />
                  <div className="h-10 animate-pulse rounded-lg bg-surface" />
                </div>
              ) : null}
              {!loading && rows.length === 0 && !error ? (
                <p className="py-6 text-center text-sm text-muted">{tHeader('pendingJobsEmpty')}</p>
              ) : null}
              <ul className="space-y-2">
                {rows.map((row) => {
                  const isPending = String(row.status ?? '').toUpperCase() === 'PENDING';
                  const progress = pendingProgress[row.id];

                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-card-border bg-background px-3 py-2.5 sm:px-4"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {resolveUsageHistoryFeatureLabel(row.featureKey, tAccount)}
                      </p>
                      <p className="text-xs text-muted">{formatWhen(row.createdAt)}</p>

                      <p className="mt-1.5 text-xs text-muted">
                        {row.notCharged ? (
                          <span className="font-medium text-foreground">{tAccount('usageHistory.notCharged')}</span>
                        ) : (
                          <>
                            <span className="text-muted">{tHeader('pendingJobsReservedPoints')}</span>{' '}
                            <span className="font-semibold tabular-nums text-foreground">{row.chargedPoints}</span>{' '}
                            <span className="text-muted">{tAccount('usageHistory.pointsUnit')}</span>
                          </>
                        )}
                      </p>

                      {isPending ? (
                        <div className="mt-2 max-w-full rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {progress?.label ?? tAccount('usageHistory.pendingQueued')}
                          </p>
                          <ProgressBar
                            value={progress?.percent ?? 10}
                            max={100}
                            ariaLabel={
                              progress?.label ?? tAccount('usageHistory.pendingQueued')
                            }
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
