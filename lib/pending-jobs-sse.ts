import { getPublicApiBaseUrl } from '@/lib/api-base';
import type { UsageHistoryPage } from '@/lib/account';
import { consumeSseWithAuth } from '@/lib/sse-auth-fetch';

export type PendingJobsSseHandlers = {
  /** Full pending page (same shape as GET usage-history?pendingOnly=true). */
  onSnapshot: (page: UsageHistoryPage) => void;
  onError: (message: string) => void;
};

/**
 * One SSE connection per logged-in user: snapshot events refresh pending job list + badge count without polling.
 */
export function openPendingJobsSseStream(handlers: PendingJobsSseHandlers): () => void {
  const base = getPublicApiBaseUrl();
  if (!base) {
    handlers.onError('API base URL is not set');
    return () => {};
  }
  const url = `${base}/api/v1/auth/pending-jobs/stream`;

  return consumeSseWithAuth(url, {
    onEvent: (eventName, data) => {
      if (eventName === 'snapshot') {
        try {
          const page = JSON.parse(data) as UsageHistoryPage;
          handlers.onSnapshot(page);
        } catch {
          handlers.onError('Invalid pending jobs snapshot');
        }
      }
    },
    onError: handlers.onError,
    onClose: () => {},
  });
}
