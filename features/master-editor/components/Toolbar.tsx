'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Filter,
  Scissors,
  SlidersHorizontal,
  Type,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  ToolbarValues,
  FilterPreset,
  TextPosition,
  PlaybackSpeed,
} from '../types';
import { PLAYBACK_SPEED_OPTIONS } from '../types';

type Tab = 'trim' | 'text' | 'filters' | 'adjust' | 'speed';

const TAB_ORDER: Tab[] = ['trim', 'text', 'filters', 'adjust', 'speed'];

const TAB_ICONS: Record<Tab, LucideIcon> = {
  trim: Scissors,
  text: Type,
  filters: Filter,
  adjust: SlidersHorizontal,
  speed: Zap,
};

const FILTER_PRESETS: FilterPreset[] = ['none', 'bw', 'warm', 'cool', 'vivid'];
const TEXT_POSITIONS: TextPosition[] = ['top', 'center', 'bottom'];

function speedLabel(s: PlaybackSpeed): string {
  return s === 1 ? '1x' : `${s}x`;
}

type Props = {
  values: ToolbarValues;
  onChange: (update: Partial<ToolbarValues>) => void;
};

export default function Toolbar({ values, onChange }: Props) {
  const t = useTranslations('master-editor.toolbar');
  const [activeTab, setActiveTab] = useState<Tab>('trim');

  const tabLabel = (tab: Tab) => {
    if (tab === 'text') return t('addText');
    return t(tab);
  };

  return (
    <div className="space-y-5">
      {/* Editing tools */}
      <div>
        <p className="video-edit-studio-kicker">{t('editingTools')}</p>
        <div
          className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3"
          role="tablist"
          aria-label={t('editingTools')}
        >
          {TAB_ORDER.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab)}
                className={`video-edit-tool-card ${active ? 'video-edit-tool-card-active' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="text-center text-[11px] font-semibold leading-tight sm:text-xs">
                  {tabLabel(tab)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Playback speed */}
      <div className="video-edit-studio-section">
        <p className="video-edit-studio-kicker mb-0">{t('playbackSpeedSection')}</p>
        <div
          className="mt-3 flex flex-wrap items-center gap-2 sm:gap-2.5"
          role="group"
          aria-label={t('playbackSpeedSection')}
        >
          {PLAYBACK_SPEED_OPTIONS.map((s) => {
            const selected = values.speed === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ speed: s })}
                aria-pressed={selected}
                className={`video-edit-speed-pill ${selected ? 'video-edit-speed-pill-active' : ''}`}
              >
                {speedLabel(s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tool panel */}
      <div className="video-edit-tool-panel">
        {activeTab === 'trim' && (
          <div className="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90">{t('trimStart')}</label>
              <input
                type="text"
                value={values.trimStart}
                onChange={(e) => onChange({ trimStart: e.target.value })}
                placeholder="0:00"
                className="w-full max-w-44 rounded-lg border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90">{t('trimEnd')}</label>
              <input
                type="text"
                value={values.trimEnd}
                onChange={(e) => onChange({ trimEnd: e.target.value })}
                placeholder="0:00"
                className="w-full max-w-44 rounded-lg border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="flex flex-wrap gap-2">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ filter: preset })}
                className={`video-edit-filter-chip ${
                  values.filter === preset ? 'video-edit-filter-chip-active' : ''
                }`}
              >
                {t(`filter${preset.charAt(0).toUpperCase() + preset.slice(1)}` as string)}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'adjust' && (
          <div className="space-y-4">
            {(
              [
                ['brightness', t('brightness')],
                ['contrast', t('contrast')],
                ['saturation', t('saturation')],
              ] as [keyof ToolbarValues, string][]
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">{label}</label>
                  <span className="text-xs text-muted">{values[key] as number}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={values[key] as number}
                  onChange={(e) => onChange({ [key]: Number(e.target.value) })}
                  className="h-1.5 w-full cursor-pointer accent-blue-500"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'speed' && (
          <p className="text-sm text-muted">{t('speedTabHint')}</p>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <input
              type="text"
              value={values.overlayText}
              onChange={(e) => onChange({ overlayText: e.target.value })}
              placeholder={t('textPlaceholder')}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">{t('position')}</p>
              <div className="flex flex-wrap gap-2">
                {TEXT_POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => onChange({ textPosition: pos })}
                    className={`video-edit-speed-pill ${
                      values.textPosition === pos ? 'video-edit-speed-pill-active' : ''
                    }`}
                  >
                    {t(`position${pos.charAt(0).toUpperCase() + pos.slice(1)}` as string)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
