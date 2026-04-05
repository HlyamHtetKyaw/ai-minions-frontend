'use client';

import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';

type Props = {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export default function TranscribeButton({ onClick, isLoading, disabled }: Props) {
  const t = useTranslations('transcribe.transcribeButton');

  return (
    <ActionButton
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      label={t('label')}
      loadingLabel={t('loading')}
      icon={<Mic className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
      className="btn-transcribe"
    />
  );
}
