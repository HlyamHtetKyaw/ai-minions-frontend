'use client';

import { useTranslations } from 'next-intl';
import ActionButton from '@/components/shared/components/action-button';

type Props = {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export default function StartButton({ onClick, isLoading, disabled }: Props) {
  const t = useTranslations('voice-gen-live.startButton');

  return (
    <ActionButton
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      label={t('label')}
      loadingLabel={t('playing')}
      className="btn-transcribe"
    />
  );
}
