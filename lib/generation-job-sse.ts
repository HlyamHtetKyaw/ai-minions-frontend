import { getPublicApiBaseUrl } from '@/lib/api-base';

/**
 * Worker / main DB stores {@code outputData} as JSON object or string; transcript may be at {@code text} or
 * {@code result.text}.
 */
export function extractTranscriptTextFromOutputData(outputData: unknown): string {
  if (outputData == null) {
    return '';
  }
  if (typeof outputData === 'string') {
    const t = outputData.trim();
    if (!t) {
      return '';
    }
    try {
      return extractTranscriptTextFromOutputData(JSON.parse(t) as unknown);
    } catch {
      return outputData;
    }
  }
  if (typeof outputData === 'object') {
    const o = outputData as Record<string, unknown>;
    if (typeof o.text === 'string' && o.text.trim()) {
      return o.text;
    }
    const r = o.result as Record<string, unknown> | undefined;
    if (r && typeof r.text === 'string') {
      return r.text;
    }
  }
  return '';
}

/** Parsed terminal SSE payload (main service + Redis publish shape). */
export type GenerationJobTerminalPayload = {
  status: 'completed' | 'failed' | 'error' | 'timeout';
  outputData?: unknown;
  message?: string;
  jobId?: number;
  generationId?: number;
};

export type GenerationJobSseHandlers = {
  onStatus: (rawData: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  /** Fired once when status is completed | failed | error | timeout (after {@link onStatus} for that chunk). */
  onTerminal?: (payload: GenerationJobTerminalPayload) => void;
};

/**
 * SSE for any {@code ai_generations} async job (transcribe, translate, voice-over, …).
 * Same cookie/credentials rules as other API calls.
 */
export function openGenerationJobSseStream(
  generationId: number,
  handlers: GenerationJobSseHandlers,
): void {
  const base = getPublicApiBaseUrl();
  if (!base) {
    handlers.onError('API base URL is not set');
    handlers.onDone();
    return;
  }
  const path = `${base}/api/v1/generations/${generationId}/stream`;
  const ac = new AbortController();
  let finished = false;
  let sawTerminalStatus = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    try {
      ac.abort();
    } catch {
      /* ignore */
    }
    handlers.onDone();
  };

  const handlePayload = (raw: string) => {
    handlers.onStatus(raw);
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const s = String(o.status ?? '').toLowerCase();
      if (s === 'completed' || s === 'failed' || s === 'error' || s === 'timeout') {
        sawTerminalStatus = true;
        const jobId = typeof o.jobId === 'number' ? o.jobId : Number(o.jobId);
        const generationId = typeof o.generationId === 'number' ? o.generationId : Number(o.generationId);
        handlers.onTerminal?.({
          status: s as GenerationJobTerminalPayload['status'],
          outputData: o.outputData,
          message: typeof o.message === 'string' ? o.message : undefined,
          jobId: Number.isFinite(jobId) ? jobId : undefined,
          generationId: Number.isFinite(generationId) ? generationId : undefined,
        });
        finish();
      }
    } catch {
      /* non-JSON chunk */
    }
  };

  void (async () => {
    try {
      const res = await fetch(path, {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
        credentials: 'include',
        signal: ac.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = `SSE open failed (${res.status})`;
        try {
          const j = JSON.parse(text) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          if (text.trim()) msg = `${msg}: ${text.slice(0, 200)}`;
        }
        if (!finished) handlers.onError(msg);
        finish();
        return;
      }

      const body = res.body;
      if (!body) {
        if (!finished) handlers.onError('SSE: empty response body');
        finish();
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
        if (eventName === 'status' || eventName === 'message') {
          handlePayload(data);
        }
      };

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) {
          if (!sawTerminalStatus && !finished) {
            handlers.onError('Stream closed before the job finished (no final status).');
            finish();
          }
          break;
        }
        carry += decoder.decode(value, { stream: true });
        const parts = carry.split(/\r?\n\r?\n/);
        carry = parts.pop() ?? '';
        for (const chunk of parts) {
          dispatchBlock(chunk);
        }
      }

      if (!finished) finish();
    } catch (e) {
      if (finished) return;
      if (e instanceof DOMException && e.name === 'AbortError') {
        finish();
        return;
      }
      handlers.onError(e instanceof Error ? e.message : String(e));
      finish();
    }
  })();
}
