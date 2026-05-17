import { nanoid } from 'nanoid';
import type { SrtCue } from '@/features/video-edit/lib/parse-srt';
import type { TextLayer } from '@/store/editorStore';
import {
  DEFAULT_CAPTION_BACKGROUND_COLOR,
  DEFAULT_SRT_BACKGROUND_OPACITY,
} from '@/lib/text-layer-caption-style';

const MIN_CLIP_SEC = 1;

export type CreateTextLayersFromSrtOptions = {
  duration: number;
  canvasWidth: number;
  canvasHeight: number;
};

/** Same layout defaults as video editor `importSrtCuesAsTextLayers`. */
export function createTextLayersFromSrtCues(
  cues: SrtCue[],
  options: CreateTextLayersFromSrtOptions,
): TextLayer[] {
  if (cues.length === 0) return [];

  const d = Math.max(0, options.duration);
  const cw = Math.max(1, options.canvasWidth);
  const ch = Math.max(1, options.canvasHeight);
  const boxW = cw > 48 ? Math.min(cw - 16, Math.max(280, cw * 0.92)) : 280;
  const boxH = Math.min(160, Math.max(72, Math.round(ch * 0.14)));
  const x = Math.max(8, Math.round((cw - boxW) / 2));
  const y = Math.max(8, Math.round(ch - boxH - Math.max(12, ch * 0.03)));
  const srtImportBatchId = nanoid();

  return cues.map((cue) => {
    let startTime = Math.max(0, cue.startTime);
    let endTime = Math.max(startTime + MIN_CLIP_SEC, cue.endTime);
    if (d > 0) {
      startTime = Math.min(startTime, d);
      endTime = Math.min(Math.max(endTime, startTime + MIN_CLIP_SEC), d);
    }
    const content = cue.content.replace(/\r\n/g, '\n').trim() || ' ';
    return {
      id: nanoid(),
      type: 'text' as const,
      content,
      x,
      y,
      width: boxW,
      height: boxH,
      fontSize: 20,
      fontFamily: 'Pyidaungsu',
      color: '#ffffff',
      opacity: 100,
      backgroundColor: DEFAULT_CAPTION_BACKGROUND_COLOR,
      backgroundOpacity: DEFAULT_SRT_BACKGROUND_OPACITY,
      startTime,
      endTime,
      srtImportBatchId,
    };
  });
}
