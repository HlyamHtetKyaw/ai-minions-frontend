import type { VoiceModelDescriptor } from '@/lib/voice-over-api';

/** UI tone categories for Gemini TTS voices (order = display order). */
export const VOICE_TONE_GROUP_IDS = [
  'energetic',
  'conversational',
  'educational',
  'professional',
  'cinematic',
] as const;

export type VoiceToneGroupId = (typeof VOICE_TONE_GROUP_IDS)[number];

const DEFAULT_TONE_GROUP: VoiceToneGroupId = 'conversational';

/** Lowercase Gemini voiceName → ordered ids per tone (matches product copy). */
export const VOICE_IDS_BY_TONE: Record<VoiceToneGroupId, readonly string[]> = {
  energetic: ['puck', 'laomedeia', 'fenrir', 'sadachbia', 'zephyr', 'autonoe'],
  conversational: ['sulafat', 'aoede', 'callirrhoe', 'umbriel', 'zubenelgenubi', 'achird', 'leda'],
  educational: ['charon', 'rasalgethi', 'sadaltager', 'iapetus', 'erinome', 'schedar'],
  professional: ['kore', 'orus', 'alnilam', 'pulcherrima'],
  cinematic: ['algenib', 'gacrux', 'algieba', 'despina', 'achernar', 'enceladus', 'vindemiatrix'],
};

export function toneGroupIdForVoiceId(voiceId: string | null | undefined): VoiceToneGroupId | null {
  if (!voiceId) return null;
  const v = voiceId.trim().toLowerCase();
  for (const tone of VOICE_TONE_GROUP_IDS) {
    if (VOICE_IDS_BY_TONE[tone].some((id) => id.toLowerCase() === v)) {
      return tone;
    }
  }
  return null;
}

export function defaultToneGroupForVoiceId(voiceId: string | null | undefined): VoiceToneGroupId {
  return toneGroupIdForVoiceId(voiceId) ?? DEFAULT_TONE_GROUP;
}

/**
 * Voices from the API catalog for one tone, preserving the canonical order within that tone.
 */
export function voicesForToneGroup(
  catalog: VoiceModelDescriptor[],
  toneId: VoiceToneGroupId,
): VoiceModelDescriptor[] {
  const byId = new Map(catalog.map((m) => [m.id.toLowerCase(), m]));
  const out: VoiceModelDescriptor[] = [];
  for (const id of VOICE_IDS_BY_TONE[toneId]) {
    const hit = byId.get(id.toLowerCase());
    if (hit) out.push(hit);
  }
  return out;
}

export function firstVoiceIdInTone(
  catalog: VoiceModelDescriptor[],
  toneId: VoiceToneGroupId,
): string | null {
  return voicesForToneGroup(catalog, toneId)[0]?.id ?? null;
}

/**
 * Maps the voice **tone group** from the UI to the voice-over API {@code style} field
 * (script delivery / tone tag — sent to main and AI service with the job).
 */
const DELIVERY_STYLE_FOR_TONE: Record<VoiceToneGroupId, string> = {
  energetic: 'Energetic',
  conversational: 'Conversational',
  educational: 'Educational',
  professional: 'Professional',
  cinematic: 'Cinematic',
};

export function deliveryStyleForToneGroup(toneId: VoiceToneGroupId): string {
  return DELIVERY_STYLE_FOR_TONE[toneId] ?? DELIVERY_STYLE_FOR_TONE.conversational;
}
