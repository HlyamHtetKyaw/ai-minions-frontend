'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleHelp, Mic } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import TranscribeButton from '@/features/transcribe/components/transcribe-button';
import TranscriptResult from '@/features/transcribe/components/transcript-result';
import { AUTH_CHANGED_EVENT, clearClientAuth, getStoredAccessToken } from '@/lib/auth-token';
import {
  transcribePrepareUpload,
  transcribeUploadToSignedUrl,
  transcribeCompleteUpload,
  openGenerationJobSseStream,
  pollAiGenerationUntilTerminal,
} from '@/lib/transcribe-api';
import { extractTranscriptTextFromOutputData } from '@/lib/generation-job-sse';

export default function TranscribePage() {
  const t = useTranslations('transcribe');
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  useEffect(() => {
    const resolve = () => setIsSignedIn(Boolean(getStoredAccessToken()));
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
  }, []);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);

  const toUserSafeError = (raw: string): string => {
    const msg = (raw ?? '').trim();
    if (!msg) return 'Something went wrong. Please try again.';

    const lower = msg.toLowerCase();

    if (lower.includes('full authentication is required')) {
      return 'Your session expired. Please sign in again.';
    }

    // Points / billing
    // Example from API: "Insufficient points: available=100, required=1000"
    if (lower.includes('insufficient points')) {
      const m = msg.match(/available\s*=\s*(\d+)\s*,\s*required\s*=\s*(\d+)/i);
      if (m) {
        const available = Number(m[1]);
        const required = Number(m[2]);
        if (Number.isFinite(available) && Number.isFinite(required)) {
          return `Not enough points. You have ${available}, but this job needs ${required}.`;
        }
      }
      return 'Not enough points to run this transcription. Please top up and try again.';
    }
    // Hide internal domain/DB details from end users.
    if (lower.includes('userpoints not found')) {
      return 'Your account points are not set up yet. Please contact support.';
    }
    if (lower.includes('user not found')) {
      return 'Account not found. Please sign in again.';
    }
    if (lower.includes('feature not found')) {
      return 'This feature is not available right now. Please try again later.';
    }
    if (lower.includes('redis') && (lower.includes('unavailable') || lower.includes('connection'))) {
      return 'Service is temporarily unavailable. Please try again in a moment.';
    }
    if (lower.includes('failed to validate connection') || lower.includes('hikaripool')) {
      return 'Server is temporarily unavailable. Please try again in a moment.';
    }

    // Generic safety net: avoid leaking ids / internals.
    if (/\buserId\s*=\s*\d+\b/i.test(msg)) {
      return 'Request failed. Please try again.';
    }

    // Otherwise show a cleaned but still user-meaningful message.
    return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
  };

  const withTimeout = async <T,>(
    p: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (t) clearTimeout(t);
    }
  };

  const parseProgressFromSse = (raw: string): { percent: number; label: string } | null => {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const statusRaw = String(o.status ?? '').toLowerCase();
      const message =
        typeof o.message === 'string' && o.message.trim()
          ? o.message
          : typeof o.step === 'string' && o.step.trim()
            ? o.step
            : statusRaw || 'working';

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

      // Fallback mapping when backend doesn't send a numeric percent.
      const map: Record<string, number> = {
        queued: 5,
        pending: 5,
        started: 10,
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
        map[statusRaw] ??
        Object.entries(map).find(([k]) => message.toLowerCase().includes(k))?.[1];
      if (typeof percent === 'number') {
        return { percent, label: message };
      }
    } catch {
      // ignore non-JSON chunks
    }
    return null;
  };

  const handleTranscribe = async () => {
    if (!uploadedFile) return;
    setIsLoading(true);
    setStatus('');
    setProgress(null);
    try {
      setStatus('Preparing upload…');
      setProgress({ percent: 10, label: 'Preparing upload…' });
      const prep = await withTimeout(
        transcribePrepareUpload(uploadedFile),
        20000,
        'Prepare upload timed out. The server may be unavailable.',
      );

      setStatus('Uploading…');
      setProgress({ percent: 25, label: 'Uploading…' });
      await withTimeout(
        transcribeUploadToSignedUrl(prep.uploadUrl, uploadedFile),
        120000,
        'Upload timed out. Check your network and try again.',
      );

      setStatus('Starting transcription…');
      setProgress({ percent: 35, label: 'Starting transcription…' });
      const complete = await withTimeout(
        transcribeCompleteUpload(prep.uploadSessionId),
        20000,
        'Starting job timed out. The server may be unhealthy (DB/Redis).',
      );

      let finished = false;
      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseProgressFromSse(raw);
          if (p) {
            setProgress(p);
            if (p.label) setStatus(p.label);
          }
        },
        onDone: () => {
          finished = true;
        },
        onError: (msg) => {
          console.warn('[Transcribe SSE] error:', msg);
          setStatus(toUserSafeError(msg));
          setProgress(null);
          finished = true;
        },
        onTerminal: (payload) => {
          const text = extractTranscriptTextFromOutputData(payload.outputData);
          if (text) {
            setTranscribedText(text);
            setStatus('');
            setProgress({ percent: 100, label: 'Completed' });
          } else {
            const raw = payload.message ?? 'No transcript text returned.';
            setStatus(toUserSafeError(raw));
            setProgress(null);
          }
        },
      });

      // SSE can close before terminal if Redis/SSE mismatch. Poll DB as a fallback.
      setTimeout(() => {
        void (async () => {
          if (finished) return;
          setStatus('Finalizing…');
          setProgress({ percent: 90, label: 'Finalizing…' });
          const snap = await pollAiGenerationUntilTerminal(complete.jobId, {
            maxAttempts: 45,
            intervalMs: 2000,
          });
          if (!snap) {
            setStatus('Timed out waiting for transcript.');
            setProgress(null);
            return;
          }
          const text = extractTranscriptTextFromOutputData(snap.outputData);
          if (text) {
            setTranscribedText(text);
            setStatus('');
            setProgress({ percent: 100, label: 'Completed' });
          } else {
            setStatus('Job finished but transcript was empty.');
            setProgress(null);
          }
        })();
      }, 8000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Transcribe] failed:', e);
      const safe = toUserSafeError(msg || 'Transcribe failed.');
      setStatus(safe);
      setProgress(null);
      if ((msg ?? '').toLowerCase().includes('full authentication is required')) {
        clearClientAuth();
        setIsSignedIn(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col px-4 py-6 sm:px-6">
          {/* Same horizontal rail as Header: mx-auto max-w-7xl + page px-4 sm:px-6 */}
          <div className="mx-auto w-full max-w-7xl">
            <div className="transcribe-shell space-y-8">
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="transcribe-icon-tile">
                    <Mic className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                action={
                  <PageHeader.IconButton aria-label={t('page.helpAria')}>
                    <CircleHelp className="h-5 w-5" />
                  </PageHeader.IconButton>
                }
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />

              <UploadZone
                accept="audio/*,video/*"
                kicker={t('uploadZone.kicker')}
                instructionPrimary={t('uploadZone.instruction')}
                instructionSecondary={t('uploadZone.formats')}
                dropzoneClassName="transcribe-dropzone"
                className="space-y-2"
                onFileChange={(f) => {
                  setUploadedFile(f);
                  setTranscribedText('');
                  setStatus('');
                }}
              />

              <TranscribeButton
                onClick={handleTranscribe}
                isLoading={isLoading}
                disabled={!uploadedFile}
              />

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Result
                </p>

                {progress && !transcribedText ? (
                  <div className="rounded-xl border border-card-border bg-card px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{progress.label}</p>
                      <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {progress.percent}%
                      </p>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-subtle">
                      <div
                        className="h-2 rounded-full bg-foreground transition-[width]"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {status ? (
                  <div className="rounded-xl border border-card-border bg-card px-4 py-3">
                    <p className="text-sm text-muted-foreground">{status}</p>
                  </div>
                ) : null}

                {transcribedText ? (
                  <TranscriptResult text={transcribedText} />
                ) : (
                  <div className="rounded-xl border border-card-border bg-card px-4 py-6">
                    <p className="text-sm font-medium text-foreground">
                      No transcript yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upload an audio/video file, then click Transcribe to generate the result here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
