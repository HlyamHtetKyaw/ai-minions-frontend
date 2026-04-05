'use client';

import { useTranslations } from 'next-intl';
import ActionButton from '@/components/shared/components/action-button';

type Props = {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export default function GenerateButton({ onClick, isLoading, disabled }: Props) {
  const t = useTranslations('ai-voice.generateButton');

  return (
    <ActionButton
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      label={t('label')}
      loadingLabel={t('loading')}
      className="btn-transcribe"
    />
  );
}
