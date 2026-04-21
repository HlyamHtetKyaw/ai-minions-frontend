'use client';

import { useTranslations } from 'next-intl';

interface Props {
  text: string;
}

export default function ResultPanel({ text }: Props) {
  const t = useTranslations('contentGeneration');

  if (!text) return null;

  return (
    <div className="content-creator-result-panel p-4">
      <p className="text-sm font-semibold text-foreground">{t('result.title')}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
