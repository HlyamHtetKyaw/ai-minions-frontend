import { nanoid } from 'nanoid';
import type { ViralClip } from '@/store/viralShortsStore';

const mockDescriptions = [
  'High energy moment with strong emotional hook. Ideal for TikTok opening.',
  'Unexpected plot twist that drives rewatch value and comment engagement.',
  'Relatable reaction moment. Strong share potential across demographics.',
  'Punchy one-liner with visual impact. Perfect 15-second cut.',
  'Conflict peak moment — generates strong emotional response in viewers.',
  'Satisfying resolution clip. High completion rate expected.',
  'Humorous moment with broad appeal. Low skip probability.',
  'Inspirational quote segment. High save and share rate predicted.',
  'Behind the scenes feel. Builds authenticity and trust with audience.',
  'Fast-paced action sequence. Optimized for Reels and Shorts algorithm.',
];

const mockTags = [
  ['hook', 'emotional', 'high-energy'],
  ['twist', 'rewatch', 'engaging'],
  ['relatable', 'shareable', 'trending'],
  ['funny', 'quick', 'punchy'],
  ['conflict', 'drama', 'tension'],
  ['satisfying', 'resolution', 'feel-good'],
  ['humor', 'broad-appeal', 'viral'],
  ['inspirational', 'motivational', 'save-worthy'],
  ['authentic', 'behind-scenes', 'raw'],
  ['action', 'fast-paced', 'dynamic'],
];

const mockTitles = [
  'The Hook Moment',
  'Plot Twist',
  'Relatable Reaction',
  'The One-Liner',
  'Peak Conflict',
  'Satisfying Ending',
  'Funny Highlight',
  'Inspirational Cut',
  'Raw & Authentic',
  'Action Sequence',
];

export function generateMockClips(
  videoDuration: number,
  targetDuration: number,
  count: number = 8,
  aspectRatio: ViralClip['aspectRatio'] = '9:16',
): ViralClip[] {
  const duration = Math.max(30, Number.isFinite(videoDuration) ? videoDuration : 600);
  const target = Math.max(5, Math.min(targetDuration, duration * 0.5));
  const minSpan = Math.max(3, Math.min(target * 0.35, duration * 0.08));
  const maxSpan = Math.min(duration * 0.35, target * 1.2, duration - 1);

  const clips: ViralClip[] = [];
  const usedRanges: [number, number][] = [];
  const usedStarts = new Set<number>();

  for (let i = 0; i < count; i++) {
    let startTime = 0;
    let endTime = 0;
    let attempts = 0;
    let ok = false;

    while (attempts < 60 && !ok) {
      attempts++;
      const maxStart = Math.max(0, Math.floor(duration - minSpan - 1));
      startTime = Math.floor(Math.random() * (maxStart + 1));
      if (usedStarts.has(startTime)) continue;

      const span =
        minSpan + Math.floor(Math.random() * Math.max(1, maxSpan - minSpan + 1));
      endTime = Math.min(Math.floor(startTime + span), Math.floor(duration));
      if (endTime - startTime < minSpan) continue;

      const overlaps = usedRanges.some(([s, e]) => startTime < e && endTime > s);
      if (overlaps) continue;

      ok = true;
    }

    if (!ok) {
      const slot = (duration / count) * i;
      startTime = Math.floor(slot);
      endTime = Math.min(Math.floor(startTime + minSpan + 5), Math.floor(duration));
      if (usedRanges.some(([s, e]) => startTime < e && endTime > s)) {
        startTime = Math.min(Math.floor(duration - minSpan - 2), startTime + 7 * (i + 1));
        endTime = Math.min(Math.floor(startTime + minSpan + 3), Math.floor(duration));
      }
    }

    usedStarts.add(startTime);
    usedRanges.push([startTime, endTime]);

    const descIndex = i % mockDescriptions.length;
    const score = Math.floor(75 + Math.random() * 25);

    clips.push({
      id: nanoid(),
      startTime,
      endTime,
      duration: endTime - startTime,
      score,
      title: mockTitles[descIndex],
      description: mockDescriptions[descIndex],
      transcript: '',
      previewUrl: null,
      previewStatus: 'idle',
      downloadUrl: null,
      aspectRatio,
      tags: [...mockTags[descIndex]],
    });
  }

  return clips.sort((a, b) => b.score - a.score);
}
