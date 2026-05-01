'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';

interface Props {
  topic: string;
  isLoading: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function GenerateButton({ topic, isLoading, disabled = false, onClick }: Props) {
  const t = useTranslations('contentGeneration');

  return (
    <div className="flex justify-start pt-1">
      <ActionButton
        onClick={onClick}
        isLoading={isLoading}
        disabled={!topic.trim() || isLoading || disabled}
        label={t('generateButton.label')}
        loadingLabel={t('generateButton.loading')}
        icon={<Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
        className="btn-transcribe"
      />
    </div>
  );
}
