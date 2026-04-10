'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

interface Props {
  text: string;
  imageDataUrl?: string;
  storageUrl?: string;
}

export default function ResultPanel({ text, imageDataUrl, storageUrl }: Props) {
  const t = useTranslations('contentGeneration');

  if (!text && !imageDataUrl) return null;

  return (
    <div className="content-creator-result-panel p-4">
      <p className="text-sm font-semibold text-foreground">{t('result.title')}</p>
      {imageDataUrl ? (
        <Image
          src={imageDataUrl}
          alt={t('result.title')}
          width={1024}
          height={1024}
          unoptimized
          className="mt-3 w-full max-w-2xl rounded-xl border border-card-border object-contain"
        />
      ) : null}
      {text ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{text}</p> : null}
      {storageUrl ? (
        <p className="mt-2 break-all text-xs text-muted">
          Storage: {storageUrl}
        </p>
      ) : null}
    </div>
  );
}
