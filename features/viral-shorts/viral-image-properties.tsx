'use client';

import { useTranslations } from 'next-intl';
import type { ImageLayer } from '@/store/editorStore';

type Props = {
  layer: ImageLayer;
  durationSec: number;
  onUpdate: (id: string, patch: Partial<ImageLayer>) => void;
};

export function ViralImageProperties({ layer, durationSec, onUpdate }: Props) {
  const t = useTranslations('viralShorts.overlays');

  return (
    <div className="space-y-2 text-[10px]">
      <label className="flex items-center gap-2 text-muted-foreground">
        {t('imageOpacity')}
        <input
          type="range"
          min={0}
          max={100}
          value={layer.opacity}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onUpdate(layer.id, { opacity: n });
          }}
          className="min-w-0 flex-1"
        />
        <span className="w-8 tabular-nums text-foreground">{layer.opacity}</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-muted-foreground">
          {t('imageStart')}
          <input
            type="number"
            min={0}
            max={durationSec}
            step={0.1}
            value={Number(layer.startTime.toFixed(2))}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              onUpdate(layer.id, { startTime: Math.max(0, v) });
            }}
            className="mt-0.5 h-7 w-full rounded border border-violet-200/50 bg-white px-1 dark:border-violet-500/20 dark:bg-zinc-900/40"
          />
        </label>
        <label className="text-muted-foreground">
          {t('imageEnd')}
          <input
            type="number"
            min={0}
            max={durationSec}
            step={0.1}
            value={Number(layer.endTime.toFixed(2))}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              onUpdate(layer.id, { endTime: v });
            }}
            className="mt-0.5 h-7 w-full rounded border border-violet-200/50 bg-white px-1 dark:border-violet-500/20 dark:bg-zinc-900/40"
          />
        </label>
      </div>
      <p className="text-[9px] leading-snug text-muted-foreground">{t('imageLogoHint')}</p>
    </div>
  );
}
