'use client';

import { useTranslations } from 'next-intl';

interface TextPanelsProps {
  sourceLabel: string;
  sourceValue: string;
  sourcePlaceholder: string;
  onSourceChange: (value: string) => void;
  translatedLabel: string;
  translatedValue: string;
  translatedPlaceholder: string;
  rows?: number;
}

/** Whitespace-delimited words (e.g. "a b" → 2; a single run without spaces → 1). */
function countWordsWhitespace(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function countCharacters(text: string): number {
  return [...text].length;
}

export default function TextPanels({
  sourceLabel,
  sourceValue,
  sourcePlaceholder,
  onSourceChange,
  translatedLabel,
  translatedValue,
  translatedPlaceholder,
  rows = 8,
}: TextPanelsProps) {
  const t = useTranslations('translation');
  const sourceCharCount = countCharacters(sourceValue);
  const sourceWordCount = countWordsWhitespace(sourceValue);

  const textareaBodyClass =
    'box-border h-28 w-full resize-none rounded-xl border px-3 pt-2.5 pb-8 text-sm text-foreground placeholder:text-muted sm:h-36 sm:px-4 sm:pt-3 sm:pb-9 md:h-44';

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:gap-4">
      <div className="flex flex-col gap-1">
        <label className="shrink-0 text-xs font-medium text-muted">{sourceLabel}</label>
        <div className="relative">
          <textarea
            value={sourceValue}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder={sourcePlaceholder}
            rows={rows}
            className={`${textareaBodyClass} border-card-border bg-surface focus:border-primary focus:outline-none`}
          />
          <p
            className="pointer-events-none absolute bottom-2 right-3 max-w-[calc(100%-1.5rem)] text-right text-xs leading-snug tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {t('sourceTextStats', { chars: sourceCharCount, words: sourceWordCount })}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="shrink-0 text-xs font-medium text-muted">{translatedLabel}</label>
        <div className="relative">
          <textarea
            value={translatedValue}
            readOnly
            placeholder={translatedPlaceholder}
            rows={rows}
            className={`${textareaBodyClass} border-card-border bg-subtle focus:outline-none`}
          />
        </div>
      </div>
    </div>
  );
}
