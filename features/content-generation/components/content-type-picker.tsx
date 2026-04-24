'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  const baseId = useId();
  const [hintKey, setHintKey] = useState<ContentTypeKey | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hintKey === null) return;

    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-content-type-hint-trigger]')) return;
      setHintKey(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHintKey(null);
    };

    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [hintKey]);

  return (
    <section className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {t('contentTypeLabel')}
      </p>
      <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0 sm:overflow-visible sm:pb-0">
        <div
          className="content-type-row min-w-130 sm:min-w-0"
          role="radiogroup"
          aria-label={t('contentTypeLabel')}
        >
          {CONTENT_TYPE_KEYS.map((key) => {
            const Icon = CONTENT_TYPE_ICONS[key];
            const active = value === key;
            const hintOpen = hintKey === key;
            const panelId = `${baseId}-hint-${key}`;
            return (
              <div
                key={key}
                className={`content-type-grid-btn relative ${active ? 'content-type-grid-btn-active' : ''} ${hintOpen ? 'z-[60]' : ''}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(key)}
                  className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent p-0 pt-1 text-center font-inherit text-inherit cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${active ? 'text-fuchsia-400' : 'text-muted'}`}
                    strokeWidth={active ? 2.25 : 2}
                    aria-hidden
                  />
                  <span className="leading-tight">{t(`contentTypes.${key}`)}</span>
                </button>
                <div className="pointer-events-none absolute right-1 top-1 z-10 flex flex-col items-end sm:right-1.5 sm:top-1.5">
                  <button
                    type="button"
                    data-content-type-hint-trigger
                    aria-label={t('contentTypeHintTriggerAria', { type: t(`contentTypes.${key}`) })}
                    aria-expanded={hintOpen}
                    aria-controls={panelId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHintKey((k) => (k === key ? null : key));
                    }}
                    className="content-type-hint-trigger pointer-events-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors sm:h-[1.375rem] sm:min-w-[1.375rem] sm:text-[11px]"
                  >
                    ?
                  </button>
                  {hintOpen ? (
                    <div
                      id={panelId}
                      ref={panelRef}
                      className="content-type-hint-popover pointer-events-auto absolute right-0 top-full z-50 mt-1 w-max max-w-[min(17.5rem,calc(100vw-2rem))] rounded-lg px-2.5 py-2 text-left max-sm:bottom-full max-sm:top-auto max-sm:mb-1 max-sm:mt-0"
                    >
                      <p className="content-type-hint m-0">{t(`contentTypeHints.${key}`)}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
