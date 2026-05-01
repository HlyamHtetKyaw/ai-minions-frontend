'use client';

import { useEffect, useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';

type FeatureHelpButtonProps = {
  ariaLabel: string;
  message: string;
};

export default function FeatureHelpButton({ ariaLabel, message }: FeatureHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const modalTitleId = useId();
  const modalBodyId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      <PageHeader.IconButton aria-label={ariaLabel} onClick={() => setIsOpen(true)}>
        <CircleHelp className="h-5 w-5" />
      </PageHeader.IconButton>

      {isOpen ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          aria-describedby={modalBodyId}
          onMouseDown={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-card-border bg-elevated shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <h3 id={modalTitleId} className="text-base font-semibold text-foreground">
                {ariaLabel}
              </h3>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <p id={modalBodyId} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {message}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
