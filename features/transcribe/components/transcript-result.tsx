'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check, Download } from 'lucide-react';

type Props = {
  text: string;
};

export default function TranscriptResult({ text }: Props) {
  const t = useTranslations('transcribe.transcriptResult');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="transcribe-result-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{t('title')}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? t('copied') : t('copy')}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
          >
            <Download className="h-3.5 w-3.5" />
            {t('download')}
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg bg-subtle p-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}
