'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeClientErrorMessage } from '@/lib/api-error-message';
import type { PointsEstimate } from '@/lib/voice-over-api';
import { voiceOverEstimatePoints } from '@/lib/voice-over-api';

export type UseVoiceOverEstimateOptions = {
  enabled?: boolean;
  /** Wait this long after the last text change before requesting (default 500). */
  debounceMs?: number;
  /** Minimum time between completed estimate requests (default 2500). */
  throttleMs?: number;
};

/**
 * Debounced + throttled calls to {@link voiceOverEstimatePoints} for live point hints while editing.
 */
export function useVoiceOverEstimate(
  text: string,
  { enabled = true, debounceMs = 500, throttleMs = 2500 }: UseVoiceOverEstimateOptions = {},
) {
  const [estimate, setEstimate] = useState<PointsEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  const lastCompleteRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setEstimate(null);
      setError(null);
      setLoading(false);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setEstimate(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;

        const since = Date.now() - lastCompleteRef.current;
        const wait = lastCompleteRef.current > 0 ? Math.max(0, throttleMs - since) : 0;
        if (wait > 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, wait);
          });
        }
        if (cancelled) return;

        const payload = textRef.current.trim();
        if (!payload) {
          if (!cancelled) {
            setEstimate(null);
            setError(null);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
        try {
          const est = await voiceOverEstimatePoints(payload);
          if (cancelled) return;
          setEstimate(est);
        } catch (e) {
          if (cancelled) return;
          setEstimate(null);
          setError(normalizeClientErrorMessage(e instanceof Error ? e.message : String(e)));
        } finally {
          lastCompleteRef.current = Date.now();
          if (!cancelled) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, enabled, debounceMs, throttleMs]);

  return { estimate, loading, error };
}
