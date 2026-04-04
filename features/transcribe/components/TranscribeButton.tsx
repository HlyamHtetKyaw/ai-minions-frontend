'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Mic } from 'lucide-react';

type Props = {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export default function TranscribeButton({ onClick, isLoading, disabled }: Props) {
  const t = useTranslations('transcribe.transcribeButton');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="btn-transcribe"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Mic className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      )}
      {isLoading ? t('loading') : t('label')}
    </button>
  );
}
