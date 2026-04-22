import type { LucideIcon } from 'lucide-react';
import type { AppPathname } from '@/i18n/routing';
import { config as contentGeneration } from './content-generation/config';
import { config as subtitles } from './subtitles/config';
import { config as transcribe } from './transcribe/config';
import { config as translate } from './translate/config';
import { config as videoEdit } from './video-edit/config';
import { config as voiceOver } from './voice-over/config';
import { config as viralShorts } from './viral-shorts/config';

export type { AppPathname };

export type FeatureConfig = {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  href: AppPathname;
};

export const FEATURES: FeatureConfig[] = [
  viralShorts,
  transcribe,
  subtitles,
  contentGeneration,
  voiceOver,
  videoEdit,
  translate,
];
