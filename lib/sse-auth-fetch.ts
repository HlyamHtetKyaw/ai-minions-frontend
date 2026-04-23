import { fetchInit, authHeaders, fetchWithAuthRetry } from '@/lib/api-auth-fetch';

type SseHandlers = {
  onOpen?: () => void;
  onEvent: (eventName: string, data: string) => void;
  onError: (message: string) => void;
  /** Transport finished (success or failure). Always called exactly once. */
  onClose: () => void;
};

/**
 * Consumes a text/event-stream using fetch + Authorization headers (Bearer),
 * unlike native EventSource which cannot attach Authorization.
 */
export function consumeSseWithAuth(url: string, handlers: SseHandlers): () => void {
  const ac = new AbortController();
  let closed = false;
  const closeOnce = () => {
    if (closed) return;
    closed = true;
    handlers.onClose();
  };

  void (async () => {
    try {
      const res = await fetchWithAuthRetry(url, {
        ...fetchInit,
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...authHeaders(),
        },
        signal: ac.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = `SSE open failed (${res.status})`;
        try {
          const j = JSON.parse(text) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          if (text.trim()) msg = `${msg}: ${text.slice(0, 240)}`;
        }
        handlers.onError(msg);
        return;
      }

      handlers.onOpen?.();

      const body = res.body;
      if (!body) {
        handlers.onError('SSE: empty response body');
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let carry = '';

      const dispatchBlock = (block: string) => {
        const lines = block.split(/\r?\n/).filter((l) => l.length > 0);
        if (lines.length === 0) return;
        if (lines.every((l) => l.startsWith(':'))) return;

        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^\s/, ''));
          }
        }
        const data = dataLines.join('\n');
        if (!data) return;
        handlers.onEvent(eventName, data);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const parts = carry.split(/\r?\n\r?\n/);
        carry = parts.pop() ?? '';
        for (const chunk of parts) dispatchBlock(chunk);
      }

      // Flush trailing partial block (best-effort)
      if (carry.trim()) dispatchBlock(carry);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return;
      }
      handlers.onError(e instanceof Error ? e.message : String(e));
    } finally {
      closeOnce();
    }
  })();

  return () => {
    try {
      ac.abort();
    } catch {
      /* ignore */
    }
  };
}
