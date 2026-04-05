'use client';

import { useTranslations } from 'next-intl';
import { Volume2, Check, Circle } from 'lucide-react';

type SentenceStatus = 'idle' | 'playing' | 'done';

type Props = {
  sentences: string[];
  currentIndex: number;
};

function statusOf(index: number, currentIndex: number): SentenceStatus {
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return 'playing';
  return 'idle';
}

export default function LivePlayer({ sentences, currentIndex }: Props) {
  const t = useTranslations('voice-gen-live.livePlayer');

  return (
    <ol className="space-y-2">
      {sentences.map((sentence, i) => {
        const status = statusOf(i, currentIndex);

        return (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
              status === 'playing'
                ? 'border-primary bg-subtle'
                : status === 'done'
                  ? 'border-card-border bg-card opacity-60'
                  : 'border-card-border bg-card'
            }`}
          >
            {/* Step number */}
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-card-border text-xs font-medium text-muted">
              {i + 1}
            </span>

            {/* Sentence text */}
            <p
              className={`min-w-0 flex-1 text-sm leading-relaxed ${
                status === 'playing' ? 'font-medium text-foreground' : 'text-muted'
              }`}
            >
              {sentence.trim()}
            </p>

            {/* Status indicator */}
            <span
              className={`mt-0.5 flex shrink-0 items-center gap-1 text-xs font-medium ${
                status === 'playing'
                  ? 'text-primary'
                  : status === 'done'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted'
              }`}
              aria-label={t(status)}
            >
              {status === 'playing' && (
                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
              )}
              {status === 'done' && <Check className="h-3.5 w-3.5" />}
              {status === 'idle' && <Circle className="h-3 w-3" />}
              <span className="hidden sm:inline">{t(status)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
