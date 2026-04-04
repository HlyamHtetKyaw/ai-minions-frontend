'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

type Props = {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export default function GenerateButton({ onClick, isLoading, disabled }: Props) {
  const t = useTranslations('ai-voice.generateButton');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isLoading ? t('loading') : t('label')}
    </button>
  );
}
