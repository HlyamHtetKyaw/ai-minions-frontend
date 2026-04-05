'use client';

import { useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';

type Props = {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export default function TranslateButton({ onClick, isLoading, disabled }: Props) {
  const t = useTranslations('translation');

  return (
    <ActionButton
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      icon={<Languages className="h-4 w-4 shrink-0" />}
      label={t('action')}
      loadingLabel={t('translating')}
      className="btn-transcribe"
    />
  );
}
