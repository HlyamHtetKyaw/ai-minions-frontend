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
  /** First byte / EventSource `open` — stream is established (before first `status` event). */
  onOpen?: () => void;
  /** Fired once when status is completed | failed | error | timeout (after {@link onStatus} for that chunk). */
  onTerminal?: (payload: GenerationJobTerminalPayload) => void;
};

/**
 * Derives UI progress from SSE JSON:
 * - Main-service hello: `{ status: "subscribed", generationId, jobId, featureName?, … }`
 * - Processing-service: `{ status: "processing", stage, jobId, generationId }` (see {@code GenerationStatusPublisher})
 */
export type GenerationSseProgressLabelOverrides = {
  /** Optional overrides for known `stage` values from processing-service. */
  stages?: Partial<Record<string, { percent: number; label: string }>>;
  /** Optional override for the initial SSE hello (`status=subscribed`). */
  subscribedLabel?: string;
};

export function parseGenerationSseProgressPayload(
  raw: string,
  overrides?: GenerationSseProgressLabelOverrides,
): { percent: number; label: string } | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const statusRaw = String(o.status ?? '').toLowerCase();

    const stepOrStage =
      (typeof o.stage === 'string' && o.stage.trim() ? o.stage : null) ??
      (typeof o.step === 'string' && o.step.trim() ? o.step : null);

    if (statusRaw === 'subscribed') {
      if (overrides?.subscribedLabel && overrides.subscribedLabel.trim()) {
        return { percent: 38, label: overrides.subscribedLabel.trim() };
      }
      const rawName =
        typeof o.featureName === 'string' && o.featureName.trim()
          ? o.featureName.trim().toLowerCase()
          : '';
      // Friendly copy for the first SSE hello (avoid raw API names like "TRANSCRIBE" in the UI).
      let label = "Hang tight — we're working on what you asked for. It won't take long!";
      if (rawName.includes('transcribe')) {
        label = "Thanks for waiting — we're getting your transcript ready for you.";
      }
      return {
        percent: 38,
        label,
      };
    }

    if (statusRaw === 'processing' && stepOrStage) {
      const stage = stepOrStage.toLowerCase();
      const stages: Record<string, { percent: number; label: string }> = {
        download: { percent: 22, label: 'Downloading media' },
        extract_audio: { percent: 38, label: 'Extracting audio' },
        normalize_audio: { percent: 48, label: 'Normalizing audio' },
        silence_removal: { percent: 58, label: 'Removing silence' },
        ai_transcription: { percent: 78, label: 'Transcribing with AI' },
        segment_audio: { percent: 62, label: 'Segmenting audio' },
        ai_subtitles: { percent: 80, label: 'Generating subtitles with AI' },
        upload_srt: { percent: 92, label: 'Uploading SRT' },
      };
      const overrideHit = overrides?.stages?.[stage];
      if (overrideHit) {
        return { percent: overrideHit.percent, label: overrideHit.label };
      }
      const hit = stages[stage];
      if (hit) {
        return { percent: hit.percent, label: hit.label };
      }
      const pretty = stage.replace(/_/g, ' ');
      return { percent: 52, label: `Processing: ${pretty}` };
    }

    const message =
      typeof o.message === 'string' && o.message.trim()
        ? o.message.trim()
        : stepOrStage
          ? stepOrStage.replace(/_/g, ' ')
          : statusRaw || 'Working…';

    const candidates = [
      o.progressPercent,
      o.percent,
      o.progress,
      (o.meta && typeof o.meta === 'object' ? (o.meta as Record<string, unknown>).progressPercent : undefined),
    ];
    const n = candidates.find((v) => typeof v === 'number') as number | undefined;
    if (typeof n === 'number' && Number.isFinite(n)) {
      return { percent: Math.max(0, Math.min(100, Math.round(n))), label: message };
    }

    const map: Record<string, number> = {
      queued: 5,
      pending: 5,
      started: 10,
      processing: 45,
      downloading: 20,
      download: 20,
      extracting: 35,
      ffmpeg: 40,
      converting: 45,
      transcribing: 70,
      transcribe: 70,
      uploading: 85,
      saving: 90,
      notifying: 95,
      completed: 100,
      failed: 100,
      error: 100,
      timeout: 100,
    };

    const percent =
      map[statusRaw] ?? Object.entries(map).find(([k]) => message.toLowerCase().includes(k))?.[1];
    if (typeof percent === 'number') {
      return { percent, label: message };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * SSE for any {@code ai_generations} async job (transcribe, translate, voice-over, …).
 *
 * Uses native {@link EventSource} with `withCredentials: true` so HttpOnly cookies are sent cross-origin.
 * Firefox (and some Chromium builds) often label cross-origin `fetch()` + `ReadableStream` SSE as "Blocked"
 * in DevTools even when CORS headers are correct; EventSource is the supported path for credentialed SSE.
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
  let finished = false;
  let sawTerminalStatus = false;
  let es: EventSource | null = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    try {
      es?.close();
    } catch {
      /* ignore */
    }
    es = null;
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
        const generationIdNum = typeof o.generationId === 'number' ? o.generationId : Number(o.generationId);
        handlers.onTerminal?.({
          status: s as GenerationJobTerminalPayload['status'],
          outputData: o.outputData,
          message: typeof o.message === 'string' ? o.message : undefined,
          jobId: Number.isFinite(jobId) ? jobId : undefined,
          generationId: Number.isFinite(generationIdNum) ? generationIdNum : undefined,
        });
        finish();
      }
    } catch {
      /* non-JSON chunk */
    }
  };

  if (typeof EventSource !== 'undefined') {
    try {
      es = new EventSource(path, { withCredentials: true });
    } catch (e) {
      handlers.onError(e instanceof Error ? e.message : String(e));
      handlers.onDone();
      return;
    }

    es.addEventListener('status', (ev: MessageEvent<string>) => {
      if (ev.data) handlePayload(ev.data);
    });

    es.addEventListener('message', (ev: MessageEvent<string>) => {
      if (ev.data) handlePayload(ev.data);
    });

    es.onopen = () => {
      if (!finished) handlers.onOpen?.();
    };

    es.onerror = () => {
      if (finished) return;
      const state = es?.readyState;
      if (state === EventSource.CLOSED) {
        if (!sawTerminalStatus) {
          handlers.onError('SSE connection closed before the job finished.');
        }
        finish();
      }
    };

    return;
  }

  /** Fallback: streaming fetch (no custom Accept — avoids extra CORS complexity in some browsers). */
  const ac = new AbortController();
  void (async () => {
    try {
      const res = await fetch(path, {
        method: 'GET',
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

      if (!finished) handlers.onOpen?.();

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
