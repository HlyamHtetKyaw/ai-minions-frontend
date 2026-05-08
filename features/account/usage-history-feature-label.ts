import type { UsageHistoryFeatureKey } from '@/lib/account';

/** `t` from `useTranslations('account')`. */
export function resolveUsageHistoryFeatureLabel(
  featureKey: UsageHistoryFeatureKey,
  t: (key: string) => string,
): string {
  const key = String(featureKey ?? '').toUpperCase();
  switch (key) {
    case 'TRANSLATE':
      return t('usageHistory.featureTranslate');
    case 'VOICE_OVER':
      return t('usageHistory.featureVoiceOver');
    case 'TRANSCRIBE':
      return t('usageHistory.featureTranscribe');
    case 'SUBTITLES':
      return t('usageHistory.featureSubtitles');
    case 'CONTENT_V2':
      return t('usageHistory.featureContentV2');
    case 'BALANCED_SYNC':
      return t('usageHistory.featureBalancedSync');
    case 'TEXT_GENERATION':
      return t('usageHistory.featureTextGeneration');
    case 'IMAGE_GENERATION':
      return t('usageHistory.featureImageGeneration');
    case 'AUDIO_GENERATION':
      return t('usageHistory.featureAudioGeneration');
    case 'VIDEO_GENERATION':
      return t('usageHistory.featureVideoGeneration');
    default:
      return key || t('usageHistory.featureUnknown');
  }
}
