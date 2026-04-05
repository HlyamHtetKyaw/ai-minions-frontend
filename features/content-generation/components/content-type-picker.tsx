'use client';

import { useTranslations } from 'next-intl';
import { FileText, Hash, Tag, Type, type LucideIcon } from 'lucide-react';

export const CONTENT_TYPE_KEYS = ['hook', 'caption', 'script', 'hashtags'] as const;
export type ContentTypeKey = (typeof CONTENT_TYPE_KEYS)[number];

const CONTENT_TYPE_ICONS: Record<ContentTypeKey, LucideIcon> = {
  hook: Hash,
  caption: FileText,
  script: Type,
  hashtags: Tag,
};

interface Props {
  value: ContentTypeKey;
  onChange: (value: ContentTypeKey) => void;
}

export default function ContentTypePicker({ value, onChange }: Props) {
  const t = useTranslations('contentGeneration');

  return (
    <section className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {t('contentTypeLabel')}
      </p>
      <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0 sm:overflow-visible sm:pb-0">
        <div
          className="content-type-row min-w-130 sm:min-w-0"
          role="tablist"
          aria-label={t('contentTypeLabel')}
        >
          {CONTENT_TYPE_KEYS.map((key) => {
            const Icon = CONTENT_TYPE_ICONS[key];
            const active = value === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(key)}
                className={`content-type-grid-btn ${active ? 'content-type-grid-btn-active' : ''}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${active ? 'text-fuchsia-400' : 'text-muted'}`}
                  strokeWidth={active ? 2.25 : 2}
                  aria-hidden
                />
                <span className="leading-tight">{t(`contentTypes.${key}`)}</span>
                {active ? (
                  <span className="content-type-hint">{t(`contentTypeHints.${key}`)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
