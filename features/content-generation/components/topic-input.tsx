'use client';

import { useTranslations } from 'next-intl';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function TopicInput({ value, onChange }: Props) {
  const t = useTranslations('contentGeneration');

  return (
    <section className="space-y-3">
      <label
        htmlFor="content-topic"
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
      >
        {t('topicLabel')}
      </label>
      <textarea
        id="content-topic"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('topicPlaceholder')}
        className="textarea-content-creator"
        rows={6}
      />
    </section>
  );
}
