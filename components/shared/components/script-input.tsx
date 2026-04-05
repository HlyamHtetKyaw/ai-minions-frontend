'use client';

import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Small caps label above the field */
  kicker?: string;
  showCharacterCount?: boolean;
  variant?: 'default' | 'voiceStudio';
  /** Muted helper line (e.g. example script) — voice studio layout only */
  exampleHint?: string;
};

export default function ScriptInput({
  value,
  onChange,
  placeholder,
  disabled,
  kicker,
  showCharacterCount = true,
  variant = 'default',
  exampleHint,
}: Props) {
  const t = useTranslations('shared.scriptInput');

  if (variant === 'voiceStudio') {
    return (
      <div className="space-y-2">
        {kicker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{kicker}</p>
        ) : null}
        <div className="voice-script-panel">
          <div className="voice-script-panel-inner">
            <FileText
              className="mt-0.5 h-4 w-4 shrink-0 text-muted"
              strokeWidth={2}
              aria-hidden
            />
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              rows={5}
              className="voice-script-textarea"
            />
          </div>
          {exampleHint ? <p className="voice-script-example">{exampleHint}</p> : null}
        </div>
        {showCharacterCount ? (
          <p className="text-right text-xs text-muted">
            {value.length} {t('characters')}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {kicker ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{kicker}</p>
      ) : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        className="w-full resize-none rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none disabled:opacity-50"
      />
      {showCharacterCount ? (
        <p className="text-right text-xs text-muted">
          {value.length} {t('characters')}
        </p>
      ) : null}
    </div>
  );
}
