'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Play, Subtitles } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';
import ProgressBar from '@/components/shared/components/progress-bar';
import {
  fetchAiGeneration,
  GENERATION_STATUS_FAILED,
  GENERATION_STATUS_SUCCESS,
  transcribeEstimatePointsFromExisting,
  transcribeFromExisting,
  type PointsEstimate,
} from '@/lib/transcribe-api';
import {
  translateBegin,
  translateEstimatePoints,
  translateExecute,
  type PointsEstimate as TranslatePointsEstimate,
} from '@/lib/translate-api';
import {
  fetchVoiceOverModels,
  normalizePersistedVoiceId,
  openVoiceOverSse,
  voiceOverPresignRead,
  voiceOverStart,
  type VoiceModelDescriptor,
} from '@/lib/voice-over-api';
import { useVoiceOverEstimate } from '@/lib/use-voice-over-estimate';
import {
  fetchSubtitleDownloadUrl,
  fetchSubtitleSrtText,
  subtitlesEstimatePointsFromExisting,
  subtitlesFromExisting,
  type PointsEstimate as SubtitlesPointsEstimate,
} from '@/lib/subtitles-api';
import { STUDIO_PREVIEW_MAX_VIDEO_HEIGHT_PX } from '@/lib/studio-preview-dimensions';
import { parseSrt, type SrtCue } from '@/features/video-edit/lib/parse-srt';
import { previewSubtitleFontPxToFfmpegFontPx } from '@/lib/subtitle-export-font-map';
import {
  extractTranscriptTextFromOutputData,
  mergeMonotonicJobProgress,
  openGenerationJobSseStream,
  parseGenerationSseProgressPayload,
  type GenerationSseProgressLabelOverrides,
} from '@/lib/generation-job-sse';
import type { GenerationJobTerminalPayload } from '@/lib/generation-job-sse';
import {
  triggerWorkspaceExportDownload,
  videoEditorExportEstimateExisting,
} from '@/lib/video-editor-api';
import { exportVideoEditorWorkspace } from '@/lib/video-editor-workspace-api';
import { balancedSyncAccept, balancedSyncEstimate, balancedSyncReject, balancedSyncStart } from '@/lib/balanced-sync-api';
import VoiceToneVoicePicker from '@/features/voice-over/components/voice-tone-voice-picker';
import {
  defaultToneGroupForVoiceId,
  deliveryStyleForToneGroup,
  firstVoiceIdInTone,
  voicesForToneGroup,
  type VoiceToneGroupId,
} from '@/lib/voice-over-tone-groups';
import { useViralOverlayStore } from '@/features/viral-shorts/viral-overlay-store';
import { ViralBlurLayer } from '@/features/viral-shorts/viral-blur-layer';
import { ViralTextLayer } from '@/features/viral-shorts/viral-text-layer';
import { ViralTimelineDock, type SrtCueForTimeline } from '@/features/viral-shorts/viral-timeline-dock';
import { ViralOverlayInspector } from '@/features/viral-shorts/viral-overlay-inspector';
import type { BlurLayer as ViralBlurLayerType, TextLayer as ViralTextLayerType } from '@/store/editorStore';
import {
  mapBlurLayersForWorkspaceExport,
  mapTextLayersForWorkspaceExport,
  viralDisplayToNaturalScale,
} from '@/lib/map-viral-layers-for-export';

type TranslateTone =
  | 'casual_social_media'
  | 'polite_educational'
  | 'formal_corporate'
  | 'youthful_trendy';

function formatVoiceIdDisplay(id: string): string {
  const t = (id ?? '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const MIN_SYNC_RATE = 0.8;
const MAX_SYNC_RATE = 1.25;
// Testing: allow up to 5x so it's obvious (production should likely be <= 1.4x).
const MAX_SYNC_RATE_STRONG = 5;

/**
 * Balanced sync worker stages: {@code download → uniform_preprocess? → gen_* → parse_srt → ffmpeg_segments → upload}.
 * Playful copy + monotonic percents; heavier “finalizing” language only after AI-ish steps.
 */
const BALANCED_SYNC_SSE_FOR_UI: GenerationSseProgressLabelOverrides = {
  subscribedLabel: 'You’re in—we’re warming up the backstage.',
  subscribedPercent: 6,
  stages: {
    download: { percent: 12, label: 'Initializing your video and audio files...' },
    uniform_preprocess: { percent: 22, label: 'Balancing overall video and voice timing...' },
    gen_original_srt: { percent: 34, label: 'Generating the initial subtitles...' },
    gen_voice_srt: { percent: 46, label: 'Refining the text for the voiceover...' },
    parse_srt: { percent: 58, label: 'Aligning the subtitles with the timing...' },
    ffmpeg_segments: { percent: 74, label: 'Stitching your video and audio together...' },
    upload: { percent: 88, label: 'Uploading your finished video...' },
  },
};

/** SSE stage labels for viral-shorts workspace export (same worker keys as video editor export). */
const VIRAL_SHORTS_EXPORT_SSE_UI: GenerationSseProgressLabelOverrides = {
  subscribedLabel: 'Export queued',
  subscribedPercent: 16,
  stages: {
    workspace_export_started: { percent: 30, label: 'Rendering timeline' },
    workspace_export_encoding: { percent: 58, label: 'Encoding video' },
    workspace_export_uploading: { percent: 84, label: 'Uploading result' },
  },
};

const PROGRESS_COMPLETION_FLASH_MS = 560;

type EditableSrtCue = SrtCue & { id: string };

function pad2(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(2, '0');
}

function pad3(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(3, '0');
}

function formatSrtTimestamp(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.round(s * 1000);
  const hh = Math.floor(totalMs / 3600_000);
  const mm = Math.floor((totalMs % 3600_000) / 60_000);
  const ss = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${pad3(ms)}`;
}

function parseTimeInput(raw: string): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  // seconds float
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  // mm:ss(.ms) or hh:mm:ss(.ms)
  const parts = t.split(':').map((p) => p.trim());
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map((p) => Number(p.replace(',', '.')));
    if (!nums.every(Number.isFinite)) return null;
    const [a, b, c] = nums;
    if (parts.length === 2) {
      const mm = a ?? 0;
      const ss = b ?? 0;
      return mm * 60 + ss;
    }
    const hh = a ?? 0;
    const mm = b ?? 0;
    const ss = c ?? 0;
    return hh * 3600 + mm * 60 + ss;
  }
  // SRT timestamp "HH:MM:SS,mmm"
  const m = t.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    const ms = Number(String(m[4]).padEnd(3, '0').slice(0, 3));
    if (![hh, mm, ss, ms].every(Number.isFinite)) return null;
    return hh * 3600 + mm * 60 + ss + ms / 1000;
  }
  return null;
}

function cuesToSrt(cues: EditableSrtCue[]): string {
  const sorted = [...cues]
    .filter((c) => c && Number.isFinite(c.startTime) && Number.isFinite(c.endTime))
    .map((c) => ({
      ...c,
      startTime: Math.max(0, c.startTime),
      endTime: Math.max(c.endTime, c.startTime + 0.05),
      content: String(c.content ?? '').trim(),
    }))
    .filter((c) => c.content.length > 0)
    .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

  return sorted
    .map((c, idx) => {
      const start = formatSrtTimestamp(c.startTime);
      const end = formatSrtTimestamp(c.endTime);
      return `${idx + 1}\n${start} --> ${end}\n${c.content}\n`;
    })
    .join('\n')
    .trim()
    .concat('\n');
}

/** Largest rectangle with the same aspect ratio as the video that fits inside maxW×maxH. */
function fitVideoDisplayRect(
  intrinsicW: number,
  intrinsicH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const iw = Math.max(1, intrinsicW);
  const ih = Math.max(1, intrinsicH);
  const mw = Math.max(1, maxW);
  const mh = Math.max(1, maxH);
  const scale = Math.min(mw / iw, mh / ih);
  return { w: iw * scale, h: ih * scale };
}

function extractWorkspaceKeyFromVideoUrl(value: string | null | undefined): string | null {
  if (value == null || typeof value !== 'string' || value.trim() === '') return null;
  try {
    const u = new URL(value);
    const frag = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
    for (const token of frag.split('&')) {
      const [k, v] = token.split('=');
      if (k === 'wk' && v != null && v.trim() !== '') {
        return decodeURIComponent(v);
      }
    }
  } catch {
    // ignore malformed URL
  }
  return null;
}

function pickTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseTerminalOutputObject(outputData: unknown): Record<string, unknown> | undefined {
  if (typeof outputData === 'string') {
    try {
      return JSON.parse(outputData) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (outputData != null && typeof outputData === 'object') {
    return outputData as Record<string, unknown>;
  }
  return undefined;
}

function extractExportResult(
  outputData: unknown,
  fallback?: { downloadUrl?: string | null; s3Key?: string | null },
): { downloadUrl: string; s3Key: string } {
  const output = parseTerminalOutputObject(outputData);
  const resultNode =
    output && typeof output.result === 'object' && output.result != null
      ? (output.result as Record<string, unknown>)
      : undefined;
  const downloadUrl =
    pickTrimmedString(resultNode?.readUrl) ||
    pickTrimmedString(resultNode?.downloadUrl) ||
    pickTrimmedString(resultNode?.storageUrl) ||
    (output
      ? pickTrimmedString(output.readUrl) ||
      pickTrimmedString(output.downloadUrl) ||
      pickTrimmedString(output.storageUrl)
      : '') ||
    pickTrimmedString(fallback?.downloadUrl) ||
    '';
  const s3Key = pickTrimmedString(resultNode?.s3Key) || pickTrimmedString(fallback?.s3Key) || '';
  return { downloadUrl, s3Key };
}

function bindMediaBufferTracking(
  media: HTMLMediaElement,
  onMetadataReady: (ready: boolean) => void,
  onBufferPct: (pct: number) => void,
  onFullyLoaded: (ready: boolean) => void,
): () => void {
  const calc = () => {
    const duration = media.duration;
    if (Number.isFinite(duration) && duration > 0) {
      onMetadataReady(true);
    } else {
      return;
    }
    let end = 0;
    try {
      if (media.buffered && media.buffered.length > 0) {
        end = media.buffered.end(media.buffered.length - 1);
      }
    } catch {
      end = 0;
    }
    const pct = Math.max(0, Math.min(1, end / duration));
    onBufferPct(pct);
    if (pct >= 0.995) {
      onFullyLoaded(true);
    }
  };

  const onProgress = () => calc();
  const onMeta = () => calc();
  const onCanPlayThrough = () => {
    calc();
    onFullyLoaded(true);
  };

  media.addEventListener('progress', onProgress);
  media.addEventListener('loadedmetadata', onMeta);
  media.addEventListener('durationchange', onMeta);
  media.addEventListener('canplaythrough', onCanPlayThrough);
  const timer = window.setInterval(calc, 400);
  calc();

  return () => {
    window.clearInterval(timer);
    media.removeEventListener('progress', onProgress);
    media.removeEventListener('loadedmetadata', onMeta);
    media.removeEventListener('durationchange', onMeta);
    media.removeEventListener('canplaythrough', onCanPlayThrough);
  };
}

type Props = {
  videoUrl: string;
  videoName: string;
  initialTranscribeGenerationId?: number | null;
  initialBalancedSyncGenerationId?: number | null;
  initialBalancedSyncPreviewUrl?: string;
  initialBalancedSyncPreviewS3Key?: string;
  initialSubtitlesGenerationId?: number | null;
  initialSubtitlesSrtKey?: string;
  initialSubtitlesDownloadUrl?: string;
  initialSubtitlesSrtText?: string;
  initialSubtitlesPosition?: { x: number; y: number };
  initialSubtitlesFontSize?: number;
  initialSubtitlesBackgroundBlur?: number;
  initialSubtitlesBackgroundOpacity?: number;
  initialTranscriptText?: string;
  initialTranslateGenerationId?: number | null;
  initialTranslatedText?: string;
  initialTone?: TranslateTone;
  initialVoiceOverAudioUrl?: string;
  initialVoiceOverS3Key?: string;
  initialVoiceOverJobId?: string | null;
  /** Persisted Gemini voice id (e.g. {@code kore}); legacy {@code woman-kore}/{@code man} normalized on load. */
  initialVoiceOverVoice?: string;
  initialVoiceOverEnabled?: boolean;
  initialOriginalAudioEnabled?: boolean;
  initialVoiceOverPlaybackRate?: number;
  initialAllowStrongerSync?: boolean;
  initialProtectFlip?: boolean;
  initialProtectHueDeg?: number;
  initialExportGenerationId?: number | null;
  initialExportedVideoUrl?: string | null;
  initialExportedVideoKey?: string | null;
  onTranscriptTextChange?: (text: string) => void;
  onTranslatedTextChange?: (text: string) => void;
  onToneChange?: (tone: TranslateTone) => void;
  onVoiceOverAudioUrlChange?: (url: string) => void;
  onVoiceOverS3KeyChange?: (key: string) => void;
  onVoiceOverJobIdChange?: (jobId: string | null) => void;
  onVoiceOverVoiceChange?: (voiceId: string) => void;
  onVoiceOverEnabledChange?: (enabled: boolean) => void;
  onOriginalAudioEnabledChange?: (enabled: boolean) => void;
  onVoiceOverPlaybackRateChange?: (rate: number) => void;
  onAllowStrongerSyncChange?: (enabled: boolean) => void;
  onProtectFlipChange?: (enabled: boolean) => void;
  onProtectHueDegChange?: (deg: number) => void;
  onTranscribeGenerationIdChange?: (id: number | null) => void;
  onTranslateGenerationIdChange?: (id: number | null) => void;
  onBalancedSyncGenerationIdChange?: (id: number | null) => void;
  onBalancedSyncPreviewUrlChange?: (url: string) => void;
  onBalancedSyncPreviewS3KeyChange?: (key: string) => void;
  onVideoUrlChange?: (url: string) => void;
  onVideoNameChange?: (name: string) => void;
  onSubtitlesGenerationIdChange?: (id: number | null) => void;
  onSubtitlesSrtKeyChange?: (key: string) => void;
  onSubtitlesDownloadUrlChange?: (url: string) => void;
  onSubtitlesSrtTextChange?: (text: string) => void;
  onSubtitlesPositionChange?: (pos: { x: number; y: number }) => void;
  onSubtitlesFontSizeChange?: (size: number) => void;
  onSubtitlesBackgroundBlurChange?: (blur: number) => void;
  onSubtitlesBackgroundOpacityChange?: (opacity: number) => void;
  onExportGenerationIdChange?: (id: number | null) => void;
  onExportedVideoUrlChange?: (url: string | null) => void;
  onExportedVideoKeyChange?: (key: string) => void;
  onDiscardWorkspace?: () => void;
  /** Persist viral workspace to the server right after export (avoids losing state if URLs refresh). */
  onExportSuccess?: () => void | Promise<void>;
  /** Best-effort immediate snapshot (debounced auto-save may lag behind active jobs). */
  onPersistWorkspaceSnapshot?: () => void | Promise<void>;
  initialViralTextLayers?: ViralTextLayerType[];
  initialViralBlurLayers?: ViralBlurLayerType[];
  onViralOverlayLayersChange?: (payload: { textLayers: ViralTextLayerType[]; blurLayers: ViralBlurLayerType[] }) => void;
};

export default function CreationStudio({
  videoUrl,
  videoName,
  initialTranscribeGenerationId,
  initialBalancedSyncGenerationId,
  initialBalancedSyncPreviewUrl,
  initialBalancedSyncPreviewS3Key,
  initialSubtitlesGenerationId,
  initialSubtitlesSrtKey,
  initialSubtitlesDownloadUrl,
  initialSubtitlesSrtText,
  initialSubtitlesPosition,
  initialSubtitlesFontSize,
  initialSubtitlesBackgroundBlur,
  initialSubtitlesBackgroundOpacity,
  initialTranscriptText,
  initialTranslateGenerationId,
  initialTranslatedText,
  initialTone,
  initialVoiceOverAudioUrl,
  initialVoiceOverS3Key,
  initialVoiceOverJobId,
  initialVoiceOverVoice,
  initialVoiceOverEnabled,
  initialOriginalAudioEnabled,
  initialVoiceOverPlaybackRate,
  initialAllowStrongerSync,
  initialProtectFlip,
  initialProtectHueDeg,
  initialExportGenerationId,
  initialExportedVideoUrl,
  initialExportedVideoKey,
  onTranscriptTextChange,
  onTranslatedTextChange,
  onToneChange,
  onVoiceOverAudioUrlChange,
  onVoiceOverS3KeyChange,
  onVoiceOverJobIdChange,
  onVoiceOverVoiceChange,
  onVoiceOverEnabledChange,
  onOriginalAudioEnabledChange,
  onVoiceOverPlaybackRateChange,
  onAllowStrongerSyncChange,
  onProtectFlipChange,
  onProtectHueDegChange,
  onTranscribeGenerationIdChange,
  onTranslateGenerationIdChange,
  onBalancedSyncGenerationIdChange,
  onBalancedSyncPreviewUrlChange,
  onBalancedSyncPreviewS3KeyChange,
  onVideoUrlChange,
  onVideoNameChange,
  onSubtitlesGenerationIdChange,
  onSubtitlesSrtKeyChange,
  onSubtitlesDownloadUrlChange,
  onSubtitlesSrtTextChange,
  onSubtitlesPositionChange,
  onSubtitlesFontSizeChange,
  onSubtitlesBackgroundBlurChange,
  onSubtitlesBackgroundOpacityChange,
  onExportGenerationIdChange,
  onExportedVideoUrlChange,
  onExportedVideoKeyChange,
  onDiscardWorkspace,
  onExportSuccess,
  onPersistWorkspaceSnapshot,
  initialViralTextLayers,
  initialViralBlurLayers,
  onViralOverlayLayersChange,
}: Props) {
  const tVo = useTranslations('voice-over');
  const tViral = useTranslations('viralShorts.voiceStudio');
  const tEditor = useTranslations('viralShorts.editor');
  const tOverlays = useTranslations('viralShorts.overlays');
  const [showTranscribeConfirm, setShowTranscribeConfirm] = useState(false);
  const [estimate, setEstimate] = useState<PointsEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ percent: number; label: string } | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const [showTranslateConfirm, setShowTranslateConfirm] = useState(false);
  const [translateEstimate, setTranslateEstimate] = useState<TranslatePointsEstimate | null>(null);
  const [translateEstimateError, setTranslateEstimateError] = useState<string | null>(null);
  const [translateEstimateLoading, setTranslateEstimateLoading] = useState(false);
  const [translateGenerationId, setTranslateGenerationId] = useState<number | null>(() =>
    typeof initialTranslateGenerationId === 'number' && Number.isFinite(initialTranslateGenerationId)
      ? initialTranslateGenerationId
      : null,
  );
  const [translateRecoveryBusy, setTranslateRecoveryBusy] = useState(false);

  const [showVoiceOverConfirm, setShowVoiceOverConfirm] = useState(false);
  const [showVoiceStyleModal, setShowVoiceStyleModal] = useState(false);
  const [voiceOverProgress, setVoiceOverProgress] = useState<{ percent: number; label: string } | null>(null);
  const [voiceOverError, setVoiceOverError] = useState<string | null>(null);

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportEstimate, setExportEstimate] = useState<{ reserveCostPoints: number } | null>(null);
  const [exportEstimateLoading, setExportEstimateLoading] = useState(false);
  const [exportEstimateError, setExportEstimateError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportGenerationId, setExportGenerationId] = useState<number | null>(() =>
    typeof initialExportGenerationId === 'number' && Number.isFinite(initialExportGenerationId)
      ? initialExportGenerationId
      : null,
  );
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(() => {
    const s = typeof initialExportedVideoUrl === 'string' ? initialExportedVideoUrl.trim() : '';
    return s ? s : null;
  });
  const [exportedVideoKey, setExportedVideoKey] = useState(() => {
    const s = typeof initialExportedVideoKey === 'string' ? initialExportedVideoKey.trim() : '';
    return s;
  });
  const [showExportDownloadNotice, setShowExportDownloadNotice] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; label: string } | null>(null);
  const [translateProgress, setTranslateProgress] = useState<{ percent: number; label: string } | null>(null);

  const [balancedSyncProgress, setBalancedSyncProgress] = useState<{ percent: number; label: string } | null>(null);
  const [balancedSyncError, setBalancedSyncError] = useState<string | null>(null);
  const [showBalancedSyncConfirm, setShowBalancedSyncConfirm] = useState(false);
  const [balancedSyncPointsEstimate, setBalancedSyncPointsEstimate] = useState<{ reserveCostPoints: number } | null>(
    null,
  );
  const [balancedSyncEstimateLoading, setBalancedSyncEstimateLoading] = useState(false);
  const [balancedSyncEstimateError, setBalancedSyncEstimateError] = useState<string | null>(null);
  const [balancedSyncGenerationId, setBalancedSyncGenerationId] = useState<number | null>(() =>
    typeof initialBalancedSyncGenerationId === 'number' && Number.isFinite(initialBalancedSyncGenerationId)
      ? initialBalancedSyncGenerationId
      : null,
  );
  const [balancedSyncPreviewUrl, setBalancedSyncPreviewUrl] = useState(() =>
    typeof initialBalancedSyncPreviewUrl === 'string' ? initialBalancedSyncPreviewUrl : '',
  );
  const [balancedSyncPreviewS3Key, setBalancedSyncPreviewS3Key] = useState(() =>
    typeof initialBalancedSyncPreviewS3Key === 'string' ? initialBalancedSyncPreviewS3Key : '',
  );
  const balancedSyncStreamRef = useRef<number | null>(null);
  const lastBalancedSseAtRef = useRef(Date.now());
  const lastTranslateSseAtRef = useRef(Date.now());
  const [showBalancedPreview, setShowBalancedPreview] = useState(false);
  const prevAudioModeRef = useRef<{
    voiceOverEnabled: boolean;
    originalAudioEnabled: boolean;
    voiceOverPlaybackRate: number;
  } | null>(null);

  const [showSubtitlesConfirm, setShowSubtitlesConfirm] = useState(false);
  const [subtitlesEstimate, setSubtitlesEstimate] = useState<SubtitlesPointsEstimate | null>(null);
  const [subtitlesEstimateError, setSubtitlesEstimateError] = useState<string | null>(null);
  const [subtitlesEstimateLoading, setSubtitlesEstimateLoading] = useState(false);
  const [subtitlesProgress, setSubtitlesProgress] = useState<{ percent: number; label: string } | null>(null);
  const [subtitlesError, setSubtitlesError] = useState<string | null>(null);
  const [subtitlesGenerationId, setSubtitlesGenerationId] = useState<number | null>(() =>
    typeof initialSubtitlesGenerationId === 'number' && Number.isFinite(initialSubtitlesGenerationId)
      ? initialSubtitlesGenerationId
      : null,
  );
  const [subtitlesSrtKey, setSubtitlesSrtKey] = useState(() =>
    typeof initialSubtitlesSrtKey === 'string' ? initialSubtitlesSrtKey : '',
  );
  const [subtitlesDownloadUrl, setSubtitlesDownloadUrl] = useState(() =>
    typeof initialSubtitlesDownloadUrl === 'string' ? initialSubtitlesDownloadUrl : '',
  );
  const [subtitlesSrtText, setSubtitlesSrtText] = useState(() =>
    typeof initialSubtitlesSrtText === 'string' ? initialSubtitlesSrtText : '',
  );
  const [subtitlesEditPosition, setSubtitlesEditPosition] = useState(true);
  const [subtitlesPosition, setSubtitlesPosition] = useState<{ x: number; y: number }>(() => {
    const p = initialSubtitlesPosition;
    const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? Math.max(0, Math.min(1, p.x)) : 0.5;
    const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? Math.max(0, Math.min(1, p.y)) : 0.88;
    return { x, y };
  });
  const [subtitlesFontSize, setSubtitlesFontSize] = useState(() => {
    const n = typeof initialSubtitlesFontSize === 'number' && Number.isFinite(initialSubtitlesFontSize) ? initialSubtitlesFontSize : 22;
    return Math.max(14, Math.min(60, Math.round(n)));
  });
  const [subtitlesBackgroundBlur, setSubtitlesBackgroundBlur] = useState(() => {
    const n =
      typeof initialSubtitlesBackgroundBlur === 'number' && Number.isFinite(initialSubtitlesBackgroundBlur)
        ? initialSubtitlesBackgroundBlur
        : 0;
    return Math.max(0, Math.min(24, Math.round(n)));
  });
  const [subtitlesBackgroundOpacity, setSubtitlesBackgroundOpacity] = useState(() => {
    const n =
      typeof initialSubtitlesBackgroundOpacity === 'number' && Number.isFinite(initialSubtitlesBackgroundOpacity)
        ? initialSubtitlesBackgroundOpacity
        : 65;
    return Math.max(0, Math.min(100, Math.round(n)));
  });
  const subtitleDragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );
  const [leftTab, setLeftTab] = useState<'script' | 'srt'>(() => (subtitlesSrtText.trim() ? 'srt' : 'script'));
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = useState(true);
  const [activeSubtitleText, setActiveSubtitleText] = useState('');

  const lastNonEmptyWorkspaceS3KeyRef = useRef<string | null>(null);
  const srtSyncFromTableRef = useRef(false);
  const [editableCues, setEditableCues] = useState<EditableSrtCue[]>(() => {
    try {
      const base = subtitlesSrtText ? parseSrt(subtitlesSrtText) : [];
      return base.map((c, i) => ({ ...c, id: `c_${i}_${Math.random().toString(16).slice(2)}` }));
    } catch {
      return [];
    }
  });
  const [selectedSrtCueId, setSelectedSrtCueId] = useState<string | null>(null);

  useEffect(() => {
    if (srtSyncFromTableRef.current) {
      srtSyncFromTableRef.current = false;
      return;
    }
    try {
      const base = subtitlesSrtText ? parseSrt(subtitlesSrtText) : [];
      setEditableCues(base.map((c, i) => ({ ...c, id: `c_${i}_${Math.random().toString(16).slice(2)}` })));
      setSelectedSrtCueId(null);
    } catch {
      setEditableCues([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitlesSrtText]);

  const [tone, setTone] = useState<TranslateTone>(() => initialTone ?? 'casual_social_media');
  const [selectedVoiceId, setSelectedVoiceId] = useState(() => normalizePersistedVoiceId(initialVoiceOverVoice));
  const [voiceToneGroupId, setVoiceToneGroupId] = useState<VoiceToneGroupId>(() =>
    defaultToneGroupForVoiceId(normalizePersistedVoiceId(initialVoiceOverVoice)),
  );
  const [voiceModelCatalog, setVoiceModelCatalog] = useState<VoiceModelDescriptor[]>([]);
  const [voiceModelsLoading, setVoiceModelsLoading] = useState(false);
  const [voiceModelsError, setVoiceModelsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVoiceModelsLoading(true);
    setVoiceModelsError(null);
    void fetchVoiceOverModels()
      .then((data) => {
        if (cancelled) return;
        const gemini = data.providers?.find((p) => String(p.provider).toUpperCase() === 'GEMINI');
        const list = gemini?.models ?? data.providers?.[0]?.models ?? [];
        setVoiceModelCatalog(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setVoiceModelCatalog([]);
          setVoiceModelsError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setVoiceModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const v = normalizePersistedVoiceId(initialVoiceOverVoice);
    setSelectedVoiceId(v);
    setVoiceToneGroupId(defaultToneGroupForVoiceId(v));
  }, [initialVoiceOverVoice]);

  useEffect(() => {
    if (voiceModelCatalog.length === 0) return;
    const ids = new Set(voiceModelCatalog.map((m) => m.id.toLowerCase()));
    const sel = selectedVoiceId.toLowerCase();

    if (!ids.has(sel)) {
      const pick =
        firstVoiceIdInTone(voiceModelCatalog, voiceToneGroupId) ??
        firstVoiceIdInTone(voiceModelCatalog, 'conversational') ??
        voiceModelCatalog[0]?.id ??
        'kore';
      setSelectedVoiceId(pick);
      setVoiceToneGroupId(defaultToneGroupForVoiceId(pick));
      return;
    }

    const inTone = voicesForToneGroup(voiceModelCatalog, voiceToneGroupId).some(
      (m) => m.id.toLowerCase() === sel,
    );
    if (!inTone) {
      setVoiceToneGroupId(defaultToneGroupForVoiceId(selectedVoiceId));
    }
  }, [voiceModelCatalog, selectedVoiceId, voiceToneGroupId]);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranscribed, setIsTranscribed] = useState(() => {
    const tr = typeof initialTranscriptText === 'string' ? initialTranscriptText : '';
    return Boolean(tr.trim());
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(() => {
    const translated = typeof initialTranslatedText === 'string' ? initialTranslatedText : '';
    return Boolean(translated.trim());
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(() => {
    const k = typeof initialVoiceOverS3Key === 'string' ? initialVoiceOverS3Key.trim() : '';
    const url = typeof initialVoiceOverAudioUrl === 'string' ? initialVoiceOverAudioUrl.trim() : '';
    return Boolean(k || url);
  });
  const [transcriptText, setTranscriptText] = useState(() =>
    typeof initialTranscriptText === 'string' ? initialTranscriptText : '',
  );
  const [transcribeGenerationId, setTranscribeGenerationId] = useState<number | null>(() =>
    typeof initialTranscribeGenerationId === 'number' && Number.isFinite(initialTranscribeGenerationId)
      ? initialTranscribeGenerationId
      : null,
  );
  const [translatedText, setTranslatedText] = useState(() =>
    typeof initialTranslatedText === 'string' ? initialTranslatedText : '',
  );
  const [voiceOverAudioUrl, setVoiceOverAudioUrl] = useState(() =>
    typeof initialVoiceOverAudioUrl === 'string' ? initialVoiceOverAudioUrl : '',
  );
  const [voiceOverPlayableUrl, setVoiceOverPlayableUrl] = useState('');
  const [voiceOverS3Key, setVoiceOverS3Key] = useState(() =>
    typeof initialVoiceOverS3Key === 'string' ? initialVoiceOverS3Key : '',
  );
  const [voiceOverJobId, setVoiceOverJobId] = useState<string | null>(() => {
    const s = typeof initialVoiceOverJobId === 'string' ? initialVoiceOverJobId.trim() : '';
    return s ? s : null;
  });
  const [voiceOverEnabled, setVoiceOverEnabled] = useState(() => Boolean(initialVoiceOverEnabled));
  const [originalAudioEnabled, setOriginalAudioEnabled] = useState(() =>
    initialOriginalAudioEnabled == null ? true : Boolean(initialOriginalAudioEnabled),
  );
  const [voiceOverPlaybackRate, setVoiceOverPlaybackRate] = useState(() => {
    const n = typeof initialVoiceOverPlaybackRate === 'number' ? initialVoiceOverPlaybackRate : 1;
    const max = Boolean(initialAllowStrongerSync) ? MAX_SYNC_RATE_STRONG : MAX_SYNC_RATE;
    return Number.isFinite(n) ? Math.max(MIN_SYNC_RATE, Math.min(max, n)) : 1;
  });
  const [allowStrongerSync, setAllowStrongerSync] = useState(() => Boolean(initialAllowStrongerSync));
  const [protectFlip, setProtectFlip] = useState(() => Boolean(initialProtectFlip));
  const [protectHueDeg, setProtectHueDeg] = useState(() => {
    const n = typeof initialProtectHueDeg === 'number' ? initialProtectHueDeg : 0;
    return Number.isFinite(n) ? Math.max(0, Math.min(180, n)) : 0;
  });
  const [syncUi, setSyncUi] = useState<{ kind: 'idle' | 'working' | 'ok' | 'warn' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });
  const [videoBufferPct, setVideoBufferPct] = useState(0);
  const [audioBufferPct, setAudioBufferPct] = useState(0);
  const [videoFullyLoaded, setVideoFullyLoaded] = useState(false);
  const [voiceFullyLoaded, setVoiceFullyLoaded] = useState(false);
  const [videoMetadataReady, setVideoMetadataReady] = useState(false);
  const [voiceMetadataReady, setVoiceMetadataReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewSlotRef = useRef<HTMLDivElement | null>(null);
  const [previewSlotPx, setPreviewSlotPx] = useState({ w: 800, h: STUDIO_PREVIEW_MAX_VIDEO_HEIGHT_PX });
  const [previewIntrinsicPx, setPreviewIntrinsicPx] = useState<{ w: number; h: number } | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const voiceObjectUrlRef = useRef<string | null>(null);

  // Normalize audio mode: never allow both (or neither).
  useEffect(() => {
    if (voiceOverEnabled && originalAudioEnabled) {
      setOriginalAudioEnabled(false);
    } else if (!voiceOverEnabled && !originalAudioEnabled) {
      setOriginalAudioEnabled(true);
    }
  }, [originalAudioEnabled, voiceOverEnabled]);

  useEffect(() => {
    const el = previewSlotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setPreviewSlotPx({
        w: Math.max(1, el.clientWidth),
        h: Math.max(1, el.clientHeight),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track buffering progress (used for Sync gating + UX, but should NOT block normal playback).
  useEffect(() => {
    setVideoBufferPct(0);
    setVideoFullyLoaded(false);
    setVideoMetadataReady(false);

    const v = videoRef.current;
    if (!v) return;
    return bindMediaBufferTracking(v, setVideoMetadataReady, setVideoBufferPct, setVideoFullyLoaded);
  }, [videoUrl]);

  useEffect(() => {
    setAudioBufferPct(0);
    setVoiceFullyLoaded(false);
    setVoiceMetadataReady(false);
    if (!voiceOverPlayableUrl && !voiceOverAudioUrl) return;

    const a = voiceRef.current;
    if (!a) return;
    return bindMediaBufferTracking(a, setVoiceMetadataReady, setAudioBufferPct, setVoiceFullyLoaded);
  }, [voiceOverAudioUrl, voiceOverPlayableUrl]);

  const [scriptText, setScriptText] = useState(() => {
    const t = typeof initialTranslatedText === 'string' ? initialTranslatedText : '';
    if (t.trim()) return t;
    return typeof initialTranscriptText === 'string' ? initialTranscriptText : '';
  });

  const voiceLabel = useMemo(() => {
    const id = selectedVoiceId.trim().toLowerCase();
    const entry = voiceModelCatalog.find((m) => m.id.toLowerCase() === id);
    const name = formatVoiceIdDisplay(selectedVoiceId);
    if (entry?.style) return `${name} — ${entry.style}`;
    return name || 'Voice';
  }, [selectedVoiceId, voiceModelCatalog]);
  const transcriptRows = useMemo(() => {
    const source = scriptText
      .split(/[။.]/)
      .map((line) => line.trim())
      .filter(Boolean);
    return source.map((_, index) => {
      const start = index * 3.2;
      const end = start + 2.6;
      return {
        id: index + 1,
        start: `${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, '0')}`,
        end: `${Math.floor(end / 60)}:${String(Math.floor(end % 60)).padStart(2, '0')}`,
      };
    });
  }, [scriptText]);

  const {
    estimate: voiceOverPointsEstimate,
    loading: voiceOverEstimateLoading,
    error: voiceOverEstimateError,
  } = useVoiceOverEstimate(scriptText, {
    enabled: isTranslated && scriptText.trim().length > 0,
  });

  const workspaceS3Key = useMemo(() => {
    // Stored as `${storageUrl}#wk=${encodeURIComponent(s3Key)}`.
    const url = String(videoUrl ?? '');
    const idx = url.indexOf('#');
    if (idx < 0) return '';
    const frag = url.slice(idx + 1);
    const params = new URLSearchParams(frag);
    const k = params.get('wk');
    try {
      return k ? decodeURIComponent(k) : '';
    } catch {
      return k ?? '';
    }
  }, [videoUrl]);

  const isBalancedPreviewMode = Boolean(balancedSyncPreviewUrl && balancedSyncPreviewS3Key);

  const activePreviewSrc = isBalancedPreviewMode ? String(balancedSyncPreviewUrl ?? '') : String(videoUrl ?? '');

  /**
   * Fixed canvas size for the preview frame.
   * The DOM dimensions stay constant so overlay layers (blur, text, SRT) never drift.
   * A CSS `transform: scale(previewScale)` is applied to fit the canvas within the
   * available slot — exactly like a real video editor's zoom-to-fit.
   */
  const PREVIEW_FIXED_MAX_W = 800;
  const previewFramePx = useMemo(() => {
    const maxW = PREVIEW_FIXED_MAX_W;
    const maxH = STUDIO_PREVIEW_MAX_VIDEO_HEIGHT_PX;
    if (!previewIntrinsicPx || previewIntrinsicPx.w <= 0 || previewIntrinsicPx.h <= 0) {
      return fitVideoDisplayRect(16, 9, maxW, maxH);
    }
    return fitVideoDisplayRect(previewIntrinsicPx.w, previewIntrinsicPx.h, maxW, maxH);
  }, [previewIntrinsicPx]);

  /** CSS scale factor to fit the fixed canvas within the measured slot (zoom-to-fit). */
  const previewScale = useMemo(() => {
    const fw = previewFramePx.w;
    const fh = previewFramePx.h;
    const padding = 16; // leave some breathing room (matches p-2 on slot)
    const slotW = Math.max(1, previewSlotPx.w - padding);
    const slotH = Math.max(1, previewSlotPx.h - padding);
    const scale = Math.min(slotW / fw, slotH / fh, 1); // never upscale beyond 1
    return Math.max(0.1, scale);
  }, [previewFramePx, previewSlotPx]);

  /** ASS burn-in uses FontSize in video pixel space (PlayResY = frame height). Match preview CSS px to that. */
  const previewBurnedSubtitleFontPx = useMemo(() => {
    const vh = previewIntrinsicPx?.h;
    if (!vh || vh <= 0 || !Number.isFinite(subtitlesFontSize)) return subtitlesFontSize;
    const scale = previewFramePx.h / vh;
    return Math.max(4, subtitlesFontSize * scale);
  }, [previewIntrinsicPx, previewFramePx.h, subtitlesFontSize]);

  const overlayTextLayers = useViralOverlayStore((s) => s.textLayers);
  const overlayBlurLayers = useViralOverlayStore((s) => s.blurLayers);
  const overlayLayerOrder = useViralOverlayStore((s) => s.layerOrder);
  const overlaySelectedId = useViralOverlayStore((s) => s.selectedLayerId);
  const overlayActiveTool = useViralOverlayStore((s) => s.activeTool);
  const overlayPreviewDuration = useViralOverlayStore((s) => s.previewDuration);
  const setOverlayPreviewDuration = useViralOverlayStore((s) => s.setPreviewDuration);
  const setOverlaySelectedId = useViralOverlayStore((s) => s.setSelectedLayerId);
  const setOverlayActiveTool = useViralOverlayStore((s) => s.setActiveTool);
  const addOverlayTextAtPlayhead = useViralOverlayStore((s) => s.addTextLayerAtPlayhead);
  const addOverlayBlurAtPlayhead = useViralOverlayStore((s) => s.addBlurLayerAtPlayhead);
  const updateOverlayText = useViralOverlayStore((s) => s.updateTextLayer);
  const updateOverlayBlur = useViralOverlayStore((s) => s.updateBlurLayer);
  const deleteOverlaySelected = useViralOverlayStore((s) => s.deleteSelectedLayer);
  const moveOverlayLayerUp = useViralOverlayStore((s) => s.moveLayerUp);
  const moveOverlayLayerDown = useViralOverlayStore((s) => s.moveLayerDown);
  const hydrateOverlays = useViralOverlayStore((s) => s.hydrate);
  const resetOverlays = useViralOverlayStore((s) => s.reset);

  const [previewPlaybackTime, setPreviewPlaybackTime] = useState(0);
  const [previewIsPlaying, setPreviewIsPlaying] = useState(false);
  const overlayHydratedRef = useRef(false);
  const previewFingerprintRef = useRef<string | null>(null);
  const overlayNotifyTimerRef = useRef<number | null>(null);

  const selectedOverlayText = useMemo(
    () => overlayTextLayers.find((l) => l.id === overlaySelectedId) ?? null,
    [overlayTextLayers, overlaySelectedId],
  );
  const selectedOverlayBlur = useMemo(
    () => overlayBlurLayers.find((l) => l.id === overlaySelectedId) ?? null,
    [overlayBlurLayers, overlaySelectedId],
  );

  useEffect(() => {
    const fp = activePreviewSrc;
    if (previewFingerprintRef.current === null) {
      previewFingerprintRef.current = fp;
      return;
    }
    if (previewFingerprintRef.current === fp) return;
    previewFingerprintRef.current = fp;
    overlayHydratedRef.current = false;
    resetOverlays();
    onViralOverlayLayersChange?.({ textLayers: [], blurLayers: [] });
  }, [activePreviewSrc, onViralOverlayLayersChange, resetOverlays]);

  useEffect(() => {
    if (overlayHydratedRef.current) return;
    if (overlayPreviewDuration <= 0) return;
    const t = initialViralTextLayers ?? [];
    const b = initialViralBlurLayers ?? [];
    if (t.length === 0 && b.length === 0) {
      overlayHydratedRef.current = true;
      return;
    }
    hydrateOverlays({ textLayers: t, blurLayers: b });
    overlayHydratedRef.current = true;
  }, [overlayPreviewDuration, initialViralTextLayers, initialViralBlurLayers, hydrateOverlays]);

  useEffect(() => {
    if (!onViralOverlayLayersChange) return;
    const unsubscribe = useViralOverlayStore.subscribe((state, prev) => {
      if (state.textLayers === prev.textLayers && state.blurLayers === prev.blurLayers) return;
      if (overlayNotifyTimerRef.current != null) window.clearTimeout(overlayNotifyTimerRef.current);
      overlayNotifyTimerRef.current = window.setTimeout(() => {
        onViralOverlayLayersChange({
          textLayers: useViralOverlayStore.getState().textLayers,
          blurLayers: useViralOverlayStore.getState().blurLayers,
        });
      }, 400);
    });
    return () => {
      unsubscribe();
      if (overlayNotifyTimerRef.current != null) window.clearTimeout(overlayNotifyTimerRef.current);
    };
  }, [onViralOverlayLayersChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      deleteOverlaySelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteOverlaySelected]);

  useEffect(() => {
    setPreviewPlaybackTime(0);
  }, [activePreviewSrc]);

  const seekPreviewRatio = useCallback(
    (ratio: number) => {
      const v = videoRef.current;
      const d = overlayPreviewDuration;
      if (!v || !Number.isFinite(d) || d <= 0) return;
      const t = Math.min(d, Math.max(0, ratio * d));
      v.currentTime = t;
      setPreviewPlaybackTime(t);
    },
    [overlayPreviewDuration],
  );

  const seekPreviewBy = useCallback(
    (deltaSec: number) => {
      const v = videoRef.current;
      const d = overlayPreviewDuration;
      if (!v || !Number.isFinite(d) || d <= 0) return;
      const t = Math.min(d, Math.max(0, v.currentTime + deltaSec));
      v.currentTime = t;
      setPreviewPlaybackTime(t);
    },
    [overlayPreviewDuration],
  );

  const togglePreviewPlayback = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => { });
    else v.pause();
  }, []);

  useEffect(() => {
    setPreviewIntrinsicPx(null);
  }, [activePreviewSrc]);

  useEffect(() => {
    // If we are showing the combined balanced preview, force video audio ON and stop voice-over audio.
    if (!isBalancedPreviewMode) return;
    const v = videoRef.current;
    const a = voiceRef.current;
    try {
      if (v) v.muted = false;
    } catch {
      /* ignore */
    }
    try {
      a?.pause();
      if (a) a.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, [isBalancedPreviewMode]);

  const applyBalancedSyncTerminalPayload = useCallback(
    (payload: import('@/lib/generation-job-sse').GenerationJobTerminalPayload) => {
      if (payload.status !== 'completed') {
        const msg = (payload.message || 'Balanced sync failed').trim();
        setBalancedSyncError(msg);
        setBalancedSyncProgress(null);
        return;
      }
      const out = payload.outputData;
      let o: any = out;
      if (typeof out === 'string') {
        try {
          o = JSON.parse(out);
        } catch {
          o = null;
        }
      }
      const readUrl = o?.result?.readUrl ?? o?.result?.audioUrl ?? null;
      const s3Key = o?.result?.s3Key ?? null;
      if (typeof readUrl !== 'string' || !readUrl.trim() || typeof s3Key !== 'string' || !s3Key.trim()) {
        setBalancedSyncError('Balanced sync finished but no video URL was returned.');
        setBalancedSyncProgress(null);
        return;
      }

      // Stop any playing voice-over audio and ensure combined video audio is used.
      try {
        voiceRef.current?.pause();
        if (voiceRef.current) voiceRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      try {
        if (videoRef.current) videoRef.current.muted = false;
      } catch {
        /* ignore */
      }

      // Temporarily force preview mode to use the combined MP4 audio (rollback on Reject).
      prevAudioModeRef.current = {
        voiceOverEnabled,
        originalAudioEnabled,
        voiceOverPlaybackRate,
      };
      setVoiceOverEnabled(false);
      setOriginalAudioEnabled(true);
      setVoiceOverPlaybackRate(1);

      setBalancedSyncPreviewUrl(String(readUrl));
      setBalancedSyncPreviewS3Key(String(s3Key));
      setBalancedSyncProgress({ percent: 100, label: 'All set — your preview’s ready!' });
      setShowBalancedPreview(true);
      window.setTimeout(() => setBalancedSyncProgress(null), PROGRESS_COMPLETION_FLASH_MS);
    },
    [originalAudioEnabled, voiceOverEnabled, voiceOverPlaybackRate],
  );

  const transcribeStreamRef = useRef<number | null>(null);
  const exportStreamRef = useRef<number | null>(null);
  const subtitlesStreamRef = useRef<number | null>(null);
  const voiceOverStreamRef = useRef<string | null>(null);

  const applyTranscribeTerminalPayload = useCallback((payload: GenerationJobTerminalPayload) => {
    const text = extractTranscriptTextFromOutputData(payload.outputData);
    if (text) {
      setIsTranscribed(true);
      setIsTranslated(false);
      setTranscriptText(text);
      setTranslatedText('');
      setScriptText(text);
      setTranscribeProgress({ percent: 100, label: 'Transcript ready' });
      window.setTimeout(() => setTranscribeProgress(null), PROGRESS_COMPLETION_FLASH_MS);
      setTranscribeError(null);
      transcribeStreamRef.current = null;
      setTranscribeGenerationId(null);
      return;
    }
    const raw = payload.message ?? 'No transcript text returned.';
    setTranscribeError(raw);
    setTranscribeProgress(null);
    transcribeStreamRef.current = null;
    setTranscribeGenerationId(null);
  }, []);

  const applyExportTerminalPayload = useCallback(
    (payload: GenerationJobTerminalPayload) => {
      if (payload.status !== 'completed') {
        setExportError(payload.message || 'Export failed');
        setExporting(false);
        setExportProgress(null);
        setExportGenerationId(null);
        return;
      }
      const { downloadUrl, s3Key } = extractExportResult(payload.outputData);
      if (!downloadUrl) {
        setExportError('Export completed but missing download URL');
        setExporting(false);
        setExportProgress(null);
        setExportGenerationId(null);
        return;
      }
      setExportedVideoUrl(downloadUrl);
      setExportedVideoKey(s3Key);
      setExportError(null);
      setExporting(false);
      setExportGenerationId(null);
      setExportProgress({ percent: 100, label: 'Export ready' });
      window.setTimeout(() => setExportProgress(null), PROGRESS_COMPLETION_FLASH_MS);
      void onExportSuccess?.();
    },
    [onExportSuccess],
  );

  const pullSubtitlesArtifacts = useCallback(
    (jobId: number) => {
      void fetchSubtitleDownloadUrl(jobId)
        .then((d) => {
          setSubtitlesDownloadUrl(d.downloadUrl);
          setSubtitlesSrtKey(d.srtKey);
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          setSubtitlesError(msg);
        });

      void fetchSubtitleSrtText(jobId)
        .then((d) => {
          setSubtitlesSrtText(d.srtText);
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          setSubtitlesError(msg);
        });
      void onPersistWorkspaceSnapshot?.();
    },
    [onPersistWorkspaceSnapshot],
  );

  const applySubtitlesJobTerminal = useCallback(
    (jobId: number, payload: GenerationJobTerminalPayload) => {
      if (payload.status !== 'completed') {
        setSubtitlesError(payload.message || 'Subtitles job failed');
        setSubtitlesProgress(null);
        return;
      }
      setSubtitlesProgress({ percent: 100, label: 'Subtitles ready' });
      window.setTimeout(() => setSubtitlesProgress(null), PROGRESS_COMPLETION_FLASH_MS);
      pullSubtitlesArtifacts(jobId);
    },
    [pullSubtitlesArtifacts],
  );

  // Resume transcription after refresh.
  useEffect(() => {
    if (!transcribeGenerationId) return;
    if (transcribeStreamRef.current === transcribeGenerationId) return;
    if (isTranscribing) return;
    transcribeStreamRef.current = transcribeGenerationId;
    setTranscribeError(null);
    // Functional updater — avoids adding transcribeProgress to deps.
    setTranscribeProgress((prev) => prev ?? { percent: 10, label: 'Resuming transcription…' });
    openGenerationJobSseStream(transcribeGenerationId, {
      onStatus: (raw) => {
        const p = parseGenerationSseProgressPayload(raw);
        if (p) setTranscribeProgress((prev) => mergeMonotonicJobProgress(prev, p));
      },
      onDone: () => {
        // Do NOT reset transcribeStreamRef — keeps the ref guard effective on any spurious dep re-runs.
        setTranscribeProgress((prev) => (prev && prev.percent < 100 ? null : prev));
      },
      onError: (msg) => {
        // Clear jobId so the first guard kills any future re-run; keep ref set as a second safety net.
        setTranscribeGenerationId(null);
        setTranscribeError(msg);
        setTranscribeProgress(null);
      },
      onTerminal: applyTranscribeTerminalPayload,
    });
    // transcribeProgress, transcriptText, isTranscribed excluded — use functional updaters / not needed to decide whether to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyTranscribeTerminalPayload, isTranscribing, transcribeGenerationId]);

  // Resume voice over after refresh (voice-over SSE uses a string jobId).
  useEffect(() => {
    if (!voiceOverJobId) return;
    if (voiceOverStreamRef.current === voiceOverJobId) return;
    if (isGenerating) return;
    if (voiceOverAudioUrl.trim()) {
      setVoiceOverJobId(null);
      return;
    }
    voiceOverStreamRef.current = voiceOverJobId;
    setVoiceOverError(null);
    // Only show "starting" progress if there is no existing progress — use functional read to avoid adding voiceOverProgress to deps.
    setVoiceOverProgress((prev) => prev ?? { percent: 10, label: tVo('progress.starting') });
    openVoiceOverSse(voiceOverJobId, {
      onStatus: (raw) => {
        const p = parseGenerationSseProgressPayload(raw);
        if (p) setVoiceOverProgress((prev) => mergeMonotonicJobProgress(prev, p));
      },
      onDone: () => {
        // Do NOT reset voiceOverStreamRef here — keep it set so the guard on re-runs prevents re-opening.
        setVoiceOverProgress((prev) => (prev && prev.percent < 100 ? null : prev));
      },
      onError: (msg) => {
        // Clear jobId immediately so the useEffect cannot re-trigger and open another SSE connection.
        setVoiceOverJobId(null);
        setVoiceOverError(msg);
        setVoiceOverProgress(null);
      },
      onTerminal: (payload) => {
        if (payload.status === 'completed' && payload.data && typeof payload.data === 'object') {
          const d = payload.data as Record<string, unknown>;
          const url = typeof d.audioUrl === 'string' ? d.audioUrl : '';
          const key = typeof d.s3Key === 'string' ? d.s3Key : '';
          if (url) {
            setVoiceOverProgress({ percent: 100, label: tVo('progress.finished') });
            window.setTimeout(() => setVoiceOverProgress(null), PROGRESS_COMPLETION_FLASH_MS);
            setVoiceOverAudioUrl(url);
            if (key) setVoiceOverS3Key(key);
            setIsGenerated(true);
            setVoiceOverEnabled(true);
            setOriginalAudioEnabled(false);
            setVoiceOverJobId(null);
            return;
          }
        }
        // Terminal failure — clear jobId to stop retrying.
        setVoiceOverJobId(null);
        setVoiceOverError(payload.message ?? 'Voice over failed');
        setVoiceOverProgress(null);
      },
    });
    // voiceOverProgress intentionally excluded — using functional setVoiceOverProgress so it doesn't trigger re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, tVo, voiceOverAudioUrl, voiceOverJobId]);

  // Resume export after refresh (do NOT auto-download; just show link when ready).
  useEffect(() => {
    if (!exportGenerationId) return;
    if (exportStreamRef.current === exportGenerationId) return;
    exportStreamRef.current = exportGenerationId;
    setExportError(null);
    setExporting(true);
    setExportProgress((prev) => prev ?? { percent: 14, label: 'Reconnecting to export…' });
    openGenerationJobSseStream(exportGenerationId, {
      onStatus: (raw) => {
        const p = parseGenerationSseProgressPayload(raw, VIRAL_SHORTS_EXPORT_SSE_UI);
        if (p) setExportProgress((prev) => mergeMonotonicJobProgress(prev, p));
      },
      onDone: () => {
        // Do NOT reset exportStreamRef — keeps ref guard effective on spurious re-runs.
        setExportProgress((prev) => (prev && prev.percent < 100 ? null : prev));
      },
      onError: (message) => {
        // Clear jobId so the first guard kills re-runs; keep ref set as secondary guard.
        setExportGenerationId(null);
        setExportError(message || 'Export stream failed');
        setExporting(false);
        setExportProgress(null);
      },
      onTerminal: applyExportTerminalPayload,
    });
    // exportedVideoUrl excluded — applyExportTerminalPayload already clears jobId on completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyExportTerminalPayload, exportGenerationId]);

  // Resume subtitles after refresh: reconnect SSE until SRT + download URL are present.
  useEffect(() => {
    if (!subtitlesGenerationId) return;
    if (subtitlesStreamRef.current === subtitlesGenerationId) return;
    subtitlesStreamRef.current = subtitlesGenerationId;
    setSubtitlesError(null);
    setSubtitlesProgress((prev) => prev ?? { percent: 12, label: 'Resuming subtitles…' });
    openGenerationJobSseStream(subtitlesGenerationId, {
      onStatus: (raw) => {
        const p = parseGenerationSseProgressPayload(raw);
        if (p) setSubtitlesProgress((prev) => mergeMonotonicJobProgress(prev, p));
      },
      onDone: () => {
        // Do NOT reset subtitlesStreamRef — keeps ref guard effective on spurious re-runs.
        setSubtitlesProgress((prev) => (prev && prev.percent < 100 ? null : prev));
      },
      onError: (msg) => {
        // Clear jobId to stop retrying; keep ref set as secondary guard.
        setSubtitlesGenerationId(null);
        setSubtitlesError(msg);
        setSubtitlesProgress(null);
      },
      onTerminal: (payload) => applySubtitlesJobTerminal(subtitlesGenerationId, payload),
    });
    // subtitlesSrtText and subtitlesDownloadUrl excluded — applySubtitlesJobTerminal clears jobId on completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySubtitlesJobTerminal, subtitlesGenerationId]);

  // Recover translate text by generation id when the HTTP response was lost (e.g. refresh).
  useEffect(() => {
    if (!translateGenerationId) return;
    if (translatedText.trim()) {
      setTranslateGenerationId(null);
      setTranslateRecoveryBusy(false);
      return;
    }
    if (!transcriptText.trim()) return;

    let cancelled = false;
    setTranslateRecoveryBusy(true);
    lastTranslateSseAtRef.current = Date.now();
    setTranslateProgress((prev) => prev ?? { percent: 15, label: 'Recovering translation…' });

    void (async () => {
      const intervalMs = 1500;
      for (let i = 0; i < 45 && !cancelled; i++) {
        const snap = await fetchAiGeneration(translateGenerationId);
        if (cancelled) return;
        if (!snap) break;
        if (snap.status === GENERATION_STATUS_FAILED) {
          if (!cancelled) {
            setTranslateGenerationId(null);
            setTranslateRecoveryBusy(false);
            setTranslateProgress(null);
          }
          return;
        }
        if (snap.status === GENERATION_STATUS_SUCCESS && snap.outputData) {
          try {
            const o = JSON.parse(snap.outputData) as { translatedText?: string };
            const next = typeof o.translatedText === 'string' ? o.translatedText : '';
            if (next.trim()) {
              setTranslatedText(next);
              setScriptText(next);
              setIsTranslated(true);
              setTranslateGenerationId(null);
              void onPersistWorkspaceSnapshot?.();
              setTranslateRecoveryBusy(false);
              setTranslateProgress(null);
              return;
            }
          } catch {
            /* ignore malformed snapshot */
          }
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      if (!cancelled) {
        setTranslateRecoveryBusy(false);
        setTranslateGenerationId(null);
        setTranslateProgress(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onPersistWorkspaceSnapshot, transcriptText, translateGenerationId, translatedText]);

  const balancedSyncCreepActive = Boolean(
    balancedSyncGenerationId != null && balancedSyncProgress != null && balancedSyncProgress.percent < 100,
  );
  useEffect(() => {
    if (!balancedSyncCreepActive) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastBalancedSseAtRef.current < 2000) return;
      setBalancedSyncProgress((prev) => {
        if (!prev || prev.percent >= 100) return prev;
        return { ...prev, percent: Math.min(96, prev.percent + 1) };
      });
    }, 1100);
    return () => window.clearInterval(id);
  }, [balancedSyncCreepActive]);

  const translateCreepActive = Boolean(
    isTranslating ||
    translateRecoveryBusy ||
    (translateGenerationId != null && !translatedText.trim()),
  );
  useEffect(() => {
    if (!translateCreepActive) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastTranslateSseAtRef.current < 1900) return;
      setTranslateProgress((prev) => {
        if (!prev || prev.percent >= 94) return prev;
        return { ...prev, percent: Math.min(92, prev.percent + 1) };
      });
    }, 1200);
    return () => window.clearInterval(id);
  }, [translateCreepActive]);

  // Resume balanced sync after refresh / navigation:
  // - If the job is still running, reconnect to SSE and keep showing progress.
  // - If the job already finished, the SSE stream returns a terminal chunk immediately.
  // IMPORTANT: balancedSyncProgress must NOT be in the dep array — every progress tick
  // would re-run the effect, reset balancedSyncStreamRef in onDone, and cause an infinite reconnect loop.
  useEffect(() => {
    if (!balancedSyncGenerationId) return;
    if (isBalancedPreviewMode) return;
    if (balancedSyncStreamRef.current === balancedSyncGenerationId) return;

    balancedSyncStreamRef.current = balancedSyncGenerationId;
    setBalancedSyncError(null);
    setBalancedSyncProgress((prev) => {
      if (prev && prev.percent >= 100) return prev;
      lastBalancedSseAtRef.current = Date.now();
      return prev ?? {
        percent: BALANCED_SYNC_SSE_FOR_UI.subscribedPercent ?? 8,
        label: 'Picking back up where we left off…',
      };
    });

    openGenerationJobSseStream(balancedSyncGenerationId, {
      onOpen: () => {
        lastBalancedSseAtRef.current = Date.now();
        setBalancedSyncProgress((prev) =>
          prev ?? {
            percent: BALANCED_SYNC_SSE_FOR_UI.subscribedPercent ?? 8,
            label: "Back online—we're syncing the signal.",
          },
        );
      },
      onStatus: (raw) => {
        const p = parseGenerationSseProgressPayload(raw, BALANCED_SYNC_SSE_FOR_UI);
        if (p) {
          lastBalancedSseAtRef.current = Date.now();
          setBalancedSyncProgress((prev) => mergeMonotonicJobProgress(prev, p));
        }
      },
      onTerminal: (payload) => {
        applyBalancedSyncTerminalPayload(payload);
      },
      onError: (message) => {
        setBalancedSyncError(message || 'Balanced sync stream error');
        // Reset the ref so user can retry, but do NOT set progress to null here —
        // that would cause the effect to re-run and open another connection.
        balancedSyncStreamRef.current = null;
        setBalancedSyncProgress(null);
      },
      onDone: () => {
        // Only clear the ref — do NOT touch progress here.
        // Setting progress to null would change the dep array trigger and cause a re-subscription loop.
        if (balancedSyncStreamRef.current === balancedSyncGenerationId) {
          balancedSyncStreamRef.current = null;
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyBalancedSyncTerminalPayload, balancedSyncGenerationId, isBalancedPreviewMode]);


  useEffect(() => {
    if (typeof onBalancedSyncGenerationIdChange === 'function') {
      onBalancedSyncGenerationIdChange(balancedSyncGenerationId);
    }
  }, [balancedSyncGenerationId, onBalancedSyncGenerationIdChange]);

  useEffect(() => {
    if (typeof onBalancedSyncPreviewUrlChange === 'function') {
      onBalancedSyncPreviewUrlChange(balancedSyncPreviewUrl);
    }
  }, [balancedSyncPreviewUrl, onBalancedSyncPreviewUrlChange]);

  useEffect(() => {
    if (typeof onBalancedSyncPreviewS3KeyChange === 'function') {
      onBalancedSyncPreviewS3KeyChange(balancedSyncPreviewS3Key);
    }
  }, [balancedSyncPreviewS3Key, onBalancedSyncPreviewS3KeyChange]);

  useEffect(() => {
    onTranscribeGenerationIdChange?.(transcribeGenerationId);
  }, [onTranscribeGenerationIdChange, transcribeGenerationId]);

  useEffect(() => {
    onTranslateGenerationIdChange?.(translateGenerationId);
  }, [onTranslateGenerationIdChange, translateGenerationId]);

  useEffect(() => {
    onVoiceOverJobIdChange?.(voiceOverJobId);
  }, [onVoiceOverJobIdChange, voiceOverJobId]);

  useEffect(() => {
    onExportGenerationIdChange?.(exportGenerationId);
  }, [exportGenerationId, onExportGenerationIdChange]);

  useEffect(() => {
    onExportedVideoUrlChange?.(exportedVideoUrl);
  }, [exportedVideoUrl, onExportedVideoUrlChange]);

  useEffect(() => {
    onExportedVideoKeyChange?.(exportedVideoKey);
  }, [exportedVideoKey, onExportedVideoKeyChange]);

  useEffect(() => {
    onSubtitlesGenerationIdChange?.(subtitlesGenerationId);
  }, [onSubtitlesGenerationIdChange, subtitlesGenerationId]);

  useEffect(() => {
    onSubtitlesSrtKeyChange?.(subtitlesSrtKey);
  }, [onSubtitlesSrtKeyChange, subtitlesSrtKey]);

  useEffect(() => {
    onSubtitlesDownloadUrlChange?.(subtitlesDownloadUrl);
  }, [onSubtitlesDownloadUrlChange, subtitlesDownloadUrl]);

  useEffect(() => {
    onSubtitlesSrtTextChange?.(subtitlesSrtText);
  }, [onSubtitlesSrtTextChange, subtitlesSrtText]);

  useEffect(() => {
    onSubtitlesPositionChange?.(subtitlesPosition);
  }, [onSubtitlesPositionChange, subtitlesPosition]);

  useEffect(() => {
    onSubtitlesFontSizeChange?.(subtitlesFontSize);
  }, [onSubtitlesFontSizeChange, subtitlesFontSize]);

  // When a subtitle cue is selected from the timeline, auto-scroll it into view in the SRT table.
  useEffect(() => {
    if (!selectedSrtCueId) return;
    // Small delay to let the leftTab state update + re-render finish
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-cue-id="${selectedSrtCueId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedSrtCueId]);

  useEffect(() => {
    onSubtitlesBackgroundBlurChange?.(subtitlesBackgroundBlur);
  }, [onSubtitlesBackgroundBlurChange, subtitlesBackgroundBlur]);

  useEffect(() => {
    onSubtitlesBackgroundOpacityChange?.(subtitlesBackgroundOpacity);
  }, [onSubtitlesBackgroundOpacityChange, subtitlesBackgroundOpacity]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!showSubtitlesOverlay) {
      setActiveSubtitleText('');
      return;
    }
    const onTime = () => {
      const t = v.currentTime;
      const cue = editableCues.find((c) => t >= c.startTime && t <= c.endTime);
      setActiveSubtitleText(cue?.content ?? '');
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('seeked', onTime);
    v.addEventListener('loadedmetadata', onTime);
    onTime();
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('seeked', onTime);
      v.removeEventListener('loadedmetadata', onTime);
    };
  }, [editableCues, showSubtitlesOverlay]);

  useEffect(() => {
    const key = workspaceS3Key.trim();
    const previous = lastNonEmptyWorkspaceS3KeyRef.current;

    if (!key) {
      // videoUrl lost #wk= (transient presign / navigation) — never reset studio state or we wipe transcript/SRT.
      return;
    }

    const switchedToDifferentVideo = previous != null && previous !== key;

    if (switchedToDifferentVideo) {
      const restoredTranscript = typeof initialTranscriptText === 'string' ? initialTranscriptText : '';
      const restoredTranslated = typeof initialTranslatedText === 'string' ? initialTranslatedText : '';
      setTranscriptText(restoredTranscript);
      setTranslatedText(restoredTranslated);
      setIsTranscribed(Boolean(restoredTranscript.trim()));
      setIsTranslated(Boolean(restoredTranslated.trim()));
      setScriptText(restoredTranslated.trim() ? restoredTranslated : restoredTranscript);
      setTranscribeError(null);
      setTranscribeProgress(null);
      setEstimate(null);
      setEstimateError(null);
      setShowTranscribeConfirm(false);
      setShowTranslateConfirm(false);
      setTranslateEstimate(null);
      setTranslateEstimateError(null);
      setTranslateEstimateLoading(false);
      setTranslateGenerationId(
        typeof initialTranslateGenerationId === 'number' && Number.isFinite(initialTranslateGenerationId)
          ? initialTranslateGenerationId
          : null,
      );
      setTranslateRecoveryBusy(false);
      setShowVoiceOverConfirm(false);
      setVoiceOverProgress(null);
      setVoiceOverError(null);
      if (initialTone) setTone(initialTone);
      setSelectedVoiceId(normalizePersistedVoiceId(initialVoiceOverVoice));
      setVoiceToneGroupId(defaultToneGroupForVoiceId(normalizePersistedVoiceId(initialVoiceOverVoice)));
      setVoiceOverAudioUrl(typeof initialVoiceOverAudioUrl === 'string' ? initialVoiceOverAudioUrl : '');
      setVoiceOverS3Key(typeof initialVoiceOverS3Key === 'string' ? initialVoiceOverS3Key : '');
      setIsGenerated(
        Boolean(
          (typeof initialVoiceOverS3Key === 'string' && initialVoiceOverS3Key.trim()) ||
          (typeof initialVoiceOverAudioUrl === 'string' && initialVoiceOverAudioUrl.trim()),
        ),
      );
      setVoiceOverEnabled(Boolean(initialVoiceOverEnabled));
      setOriginalAudioEnabled(initialOriginalAudioEnabled == null ? true : Boolean(initialOriginalAudioEnabled));
      const r = typeof initialVoiceOverPlaybackRate === 'number' ? initialVoiceOverPlaybackRate : 1;
      {
        const max = Boolean(initialAllowStrongerSync) ? MAX_SYNC_RATE_STRONG : MAX_SYNC_RATE;
        setVoiceOverPlaybackRate(Number.isFinite(r) ? Math.max(MIN_SYNC_RATE, Math.min(max, r)) : 1);
      }
      setAllowStrongerSync(Boolean(initialAllowStrongerSync));
    }

    lastNonEmptyWorkspaceS3KeyRef.current = key;

    setEstimateLoading(true);
    (async () => {
      try {
        const est = await transcribeEstimatePointsFromExisting(key, 'video');
        setEstimate(est);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setEstimateError(msg);
      } finally {
        setEstimateLoading(false);
      }
    })();
    // initial* only consulted when `switchedToDifferentVideo`; deps intentionally workspace key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-running on every parent field edit
  }, [workspaceS3Key]);

  useEffect(() => {
    if (typeof onTranscriptTextChange === 'function') {
      onTranscriptTextChange(transcriptText);
    }
  }, [onTranscriptTextChange, transcriptText]);

  useEffect(() => {
    if (typeof onTranslatedTextChange === 'function') {
      onTranslatedTextChange(translatedText);
    }
  }, [onTranslatedTextChange, translatedText]);

  useEffect(() => {
    if (typeof onToneChange === 'function') {
      onToneChange(tone);
    }
  }, [onToneChange, tone]);

  useEffect(() => {
    if (typeof onVoiceOverAudioUrlChange === 'function') {
      onVoiceOverAudioUrlChange(voiceOverAudioUrl);
    }
  }, [onVoiceOverAudioUrlChange, voiceOverAudioUrl]);

  // Download full voice-over audio and play from a blob URL to avoid "1s loop" streaming issues.
  useEffect(() => {
    let cancelled = false;

    const prev = voiceObjectUrlRef.current;
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        /* ignore */
      }
      voiceObjectUrlRef.current = null;
    }
    setVoiceOverPlayableUrl('');

    if (!voiceOverAudioUrl) return;

    (async () => {
      try {
        let url = voiceOverAudioUrl;
        // If we have a stable key, refresh presigned URL once before downloading.
        if (voiceOverS3Key) {
          try {
            url = await voiceOverPresignRead(voiceOverS3Key);
            if (!cancelled && url && url !== voiceOverAudioUrl) {
              setVoiceOverAudioUrl(url);
            }
          } catch {
            // ignore
          }
        }

        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Voice over download failed (${res.status}) ${text}`.trim());
        }
        const blob = await res.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        voiceObjectUrlRef.current = objectUrl;
        setVoiceOverPlayableUrl(objectUrl);
        setVoiceFullyLoaded(true);
        setAudioBufferPct(1);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setVoiceOverError(msg || 'Failed to load voice over audio');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [voiceOverAudioUrl, voiceOverS3Key]);

  useEffect(() => {
    if (typeof onVoiceOverS3KeyChange === 'function') {
      onVoiceOverS3KeyChange(voiceOverS3Key);
    }
  }, [onVoiceOverS3KeyChange, voiceOverS3Key]);

  useEffect(() => {
    if (typeof onVoiceOverVoiceChange === 'function') {
      onVoiceOverVoiceChange(selectedVoiceId);
    }
  }, [onVoiceOverVoiceChange, selectedVoiceId]);

  useEffect(() => {
    if (typeof onVoiceOverEnabledChange === 'function') {
      onVoiceOverEnabledChange(voiceOverEnabled);
    }
  }, [onVoiceOverEnabledChange, voiceOverEnabled]);

  useEffect(() => {
    if (typeof onOriginalAudioEnabledChange === 'function') {
      onOriginalAudioEnabledChange(originalAudioEnabled);
    }
  }, [onOriginalAudioEnabledChange, originalAudioEnabled]);

  useEffect(() => {
    if (typeof onVoiceOverPlaybackRateChange === 'function') {
      onVoiceOverPlaybackRateChange(voiceOverPlaybackRate);
    }
  }, [onVoiceOverPlaybackRateChange, voiceOverPlaybackRate]);

  useEffect(() => {
    if (typeof onAllowStrongerSyncChange === 'function') {
      onAllowStrongerSyncChange(allowStrongerSync);
    }
  }, [allowStrongerSync, onAllowStrongerSyncChange]);

  useEffect(() => {
    if (typeof onProtectFlipChange === 'function') {
      onProtectFlipChange(protectFlip);
    }
  }, [onProtectFlipChange, protectFlip]);

  useEffect(() => {
    if (typeof onProtectHueDegChange === 'function') {
      onProtectHueDegChange(protectHueDeg);
    }
  }, [onProtectHueDegChange, protectHueDeg]);

  // Voice-over playback (simple + stable):
  // - Sync speed means: apply `voiceOverPlaybackRate` to the voice track.
  // - Video is the controller (play/pause/seek). No drift correction, no extra coupling.
  useEffect(() => {
    const v = videoRef.current;
    const a = voiceRef.current;
    if (!v) return;

    if (isBalancedPreviewMode) {
      // Combined preview contains its own audio track; do not let voice-over logic mute or play anything.
      try {
        v.muted = false;
      } catch {
        /* ignore */
      }
      try {
        a?.pause();
      } catch {
        /* ignore */
      }
      return;
    }

    const wantVoice = Boolean(voiceOverAudioUrl) && voiceOverEnabled && !originalAudioEnabled;
    try {
      if (wantVoice) {
        v.muted = true;
      } else {
        // Allow the user to hear the video's original audio track.
        // Some browsers can keep a "stuck muted" state unless we explicitly unmute + restore volume.
        v.muted = false;
        if (!Number.isFinite(v.volume) || v.volume <= 0) v.volume = 1;
        // Prevent default-muted behaviors from fighting the controls icon.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyV = v as any;
        if (typeof anyV.defaultMuted === 'boolean') anyV.defaultMuted = false;
      }
    } catch {
      /* ignore */
    }
    if (!a) return;

    if (!wantVoice) {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      return;
    }

    // Ensure audible output.
    try {
      a.muted = false;
      a.volume = 1;
    } catch {
      /* ignore */
    }

    const hardSyncToVideo = () => {
      try {
        a.currentTime = v.currentTime;
      } catch {
        /* ignore */
      }
    };

    const applyVoiceRate = () => {
      try {
        a.playbackRate = voiceOverPlaybackRate;
      } catch {
        /* ignore */
      }
    };

    const onPlay = () => {
      hardSyncToVideo();
      applyVoiceRate();
      // Don't spam play() calls — only try when paused.
      if (a.paused) {
        void a.play().catch(() => { });
      }
    };
    const onPause = () => {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
    };
    const onSeeked = () => {
      hardSyncToVideo();
      applyVoiceRate();
      if (!v.paused && a.paused) void a.play().catch(() => { });
    };
    const onEnded = () => {
      // Ensure voice-over doesn't keep playing after video completes.
      try {
        a.pause();
        a.currentTime = v.duration || a.duration || a.currentTime;
      } catch {
        /* ignore */
      }
    };
    const onRateChange = () => {
      // Keep voice rate stable even if user changes video speed.
      applyVoiceRate();
    };

    // Prime audio element
    try {
      applyVoiceRate();
      hardSyncToVideo();
    } catch {
      /* ignore */
    }

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('ratechange', onRateChange);
    v.addEventListener('ended', onEnded);

    // Do NOT auto-resync during playback.
    // Any hard seek while playing can cause audible repeats ("da da da...") on some browsers/decoders.
    // We only sync on explicit user actions (play/seek) and rely on the base playbackRate.

    // If video already playing, start voice immediately (toggle case)
    if (!v.paused) {
      onPlay();
    }

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('ratechange', onRateChange);
      v.removeEventListener('ended', onEnded);
    };
  }, [originalAudioEnabled, voiceOverAudioUrl, voiceOverEnabled, voiceOverPlaybackRate]);

  const handleSyncVoiceToVideo = async () => {
    setSyncUi({ kind: 'working', message: 'Syncing…' });
    const v = videoRef.current;
    const a = voiceRef.current;
    if (!v || !a || !voiceOverAudioUrl) {
      setVoiceOverError('Generate voice over first, then sync.');
      setSyncUi({ kind: 'error', message: 'Generate voice over first, then sync.' });
      return;
    }

    const waitForDuration = (el: HTMLMediaElement, timeoutMs: number): Promise<number> => {
      const current = el.duration;
      if (Number.isFinite(current) && current > 0) return Promise.resolve(current);
      return new Promise((resolve, reject) => {
        const tmr = window.setTimeout(() => {
          cleanup();
          reject(new Error('duration timeout'));
        }, timeoutMs);
        const onMeta = () => {
          const d = el.duration;
          if (Number.isFinite(d) && d > 0) {
            cleanup();
            resolve(d);
          }
        };
        const cleanup = () => {
          window.clearTimeout(tmr);
          el.removeEventListener('loadedmetadata', onMeta);
          el.removeEventListener('durationchange', onMeta);
          el.removeEventListener('canplay', onMeta);
        };
        el.addEventListener('loadedmetadata', onMeta);
        el.addEventListener('durationchange', onMeta);
        el.addEventListener('canplay', onMeta);
        onMeta();
      });
    };

    let vd = v.duration;
    let ad = a.duration;
    if (!Number.isFinite(vd) || vd <= 0) {
      try {
        vd = await waitForDuration(v, 2500);
      } catch {
        /* ignore */
      }
    }
    if (!Number.isFinite(ad) || ad <= 0) {
      try {
        ad = await waitForDuration(a, 2500);
      } catch {
        /* ignore */
      }
    }
    if (!Number.isFinite(vd) || !Number.isFinite(ad) || vd <= 0 || ad <= 0) {
      setVoiceOverError('Video/audio duration not ready yet. Try playing both once, then Sync again.');
      setSyncUi({ kind: 'error', message: 'Duration not ready. Try playing once, then Sync again.' });
      return;
    }
    // Want (ad / rate) ~= vd  =>  rate = ad / vd
    const desired = ad / vd;
    const max = allowStrongerSync ? MAX_SYNC_RATE_STRONG : MAX_SYNC_RATE;
    const clamped = Math.max(MIN_SYNC_RATE, Math.min(max, desired));
    setVoiceOverPlaybackRate(clamped);
    if (Math.abs(desired - clamped) > 0.001) {
      setVoiceOverError('Sync applied with safe limits. If it still feels off, shorten script or trim video.');
      setSyncUi({
        kind: 'warn',
        message: `Sync applied: video ${vd.toFixed(1)}s, voice ${ad.toFixed(1)}s → ${clamped.toFixed(2)}× (limited).`,
      });
    } else {
      setVoiceOverError(null);
      setSyncUi({ kind: 'ok', message: `Synced: video ${vd.toFixed(1)}s, voice ${ad.toFixed(1)}s → ${clamped.toFixed(2)}×.` });
    }
    try {
      a.playbackRate = (v.playbackRate || 1) * clamped;
    } catch {
      /* ignore */
    }
    // If voiceover mode is active and video playing, resync immediately.
    if (voiceOverEnabled && !originalAudioEnabled && !v.paused) {
      try {
        a.currentTime = v.currentTime;
      } catch {
        /* ignore */
      }
      void a.play().catch(() => { });
    }

    // Auto-clear the message after a bit.
    window.setTimeout(() => {
      setSyncUi((prev) => (prev.kind === 'working' ? prev : { kind: 'idle', message: '' }));
    }, 3500);
  };

  const handleStartBalancedSync = async () => {
    setBalancedSyncError(null);
    lastBalancedSseAtRef.current = Date.now();
    setBalancedSyncProgress({ percent: 4, label: 'Saving your seat in line—we’ll start shortly.' });
    try {
      if (!workspaceS3Key) {
        throw new Error('Video key is missing. Please re-upload the video.');
      }
      if (!voiceOverS3Key) {
        throw new Error('Voice over key is missing. Generate voice over again.');
      }
      const v = videoRef.current;
      const a = voiceRef.current;
      const vd = v?.duration;
      const ad = a?.duration;
      if (!vd || !ad || !Number.isFinite(vd) || !Number.isFinite(ad) || vd <= 0 || ad <= 0) {
        throw new Error('Duration not ready yet. Play the video once and try again.');
      }
      const started = await balancedSyncStart({
        videoS3Key: workspaceS3Key,
        voiceOverS3Key,
        videoDurationSec: vd,
        voiceDurationSec: ad,
        protectFlip,
        protectHueDeg,
      });
      setBalancedSyncGenerationId(started.generationId);

      openGenerationJobSseStream(started.generationId, {
        onOpen: () => {
          lastBalancedSseAtRef.current = Date.now();
          const pct = BALANCED_SYNC_SSE_FOR_UI.subscribedPercent ?? 8;
          const lbl = BALANCED_SYNC_SSE_FOR_UI.subscribedLabel ?? 'Connecting…';
          setBalancedSyncProgress({ percent: pct, label: lbl });
        },
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw, BALANCED_SYNC_SSE_FOR_UI);
          if (p) {
            lastBalancedSseAtRef.current = Date.now();
            setBalancedSyncProgress((prev) => mergeMonotonicJobProgress(prev, p));
          }
        },
        onTerminal: (payload) => {
          if (payload.status !== 'completed') {
            throw new Error(payload.message || 'Balanced sync failed');
          }
          const out = payload.outputData;
          let o: any = out;
          if (typeof out === 'string') {
            try {
              o = JSON.parse(out);
            } catch {
              o = null;
            }
          }
          const readUrl = o?.result?.readUrl ?? o?.result?.audioUrl ?? null;
          const s3Key = o?.result?.s3Key ?? null;
          if (typeof readUrl !== 'string' || !readUrl.trim() || typeof s3Key !== 'string' || !s3Key.trim()) {
            throw new Error('Balanced sync finished but no video URL was returned.');
          }

          // Stop any playing voice-over audio and ensure combined video audio is used.
          try {
            voiceRef.current?.pause();
            if (voiceRef.current) voiceRef.current.currentTime = 0;
          } catch {
            /* ignore */
          }
          try {
            if (videoRef.current) videoRef.current.muted = false;
          } catch {
            /* ignore */
          }

          // Temporarily force preview mode to use the combined MP4 audio (rollback on Reject).
          prevAudioModeRef.current = {
            voiceOverEnabled,
            originalAudioEnabled,
            voiceOverPlaybackRate,
          };
          setVoiceOverEnabled(false);
          setOriginalAudioEnabled(true);
          setVoiceOverPlaybackRate(1);

          setBalancedSyncPreviewUrl(String(readUrl));
          setBalancedSyncPreviewS3Key(String(s3Key));
          setBalancedSyncProgress({ percent: 100, label: 'All set — your preview’s ready!' });
          setShowBalancedPreview(true);
          window.setTimeout(() => setBalancedSyncProgress(null), PROGRESS_COMPLETION_FLASH_MS);
        },
        onError: (message) => {
          setBalancedSyncError(message || 'Balanced sync stream error');
          setBalancedSyncProgress(null);
        },
        onDone: () => {
          setBalancedSyncProgress((prev) => (prev && prev.percent < 100 ? null : prev));
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBalancedSyncError(msg || 'Balanced sync failed');
      setBalancedSyncProgress(null);
    }
  };

  const handleBalancedSyncClick = async () => {
    setBalancedSyncEstimateError(null);
    setBalancedSyncPointsEstimate(null);
    setBalancedSyncEstimateLoading(true);
    try {
      if (!workspaceS3Key) throw new Error('Video key is missing. Please re-upload the video.');
      if (!voiceOverS3Key) throw new Error('Voice over key is missing. Generate voice over again.');
      const est = await balancedSyncEstimate({ videoS3Key: workspaceS3Key, voiceOverS3Key });
      const reserve = Number(est.reserveCostPoints);
      setBalancedSyncPointsEstimate({ reserveCostPoints: Number.isFinite(reserve) ? reserve : 0 });
      setShowBalancedSyncConfirm(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBalancedSyncEstimateError(msg || 'Failed to estimate points');
    } finally {
      setBalancedSyncEstimateLoading(false);
    }
  };

  const handleRejectBalancedSync = async () => {
    setBalancedSyncError(null);
    if (!balancedSyncPreviewS3Key) return;
    try {
      await balancedSyncReject({
        balancedVideoS3Key: balancedSyncPreviewS3Key,
        generationId: balancedSyncGenerationId ?? undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBalancedSyncError(msg || 'Failed to discard balanced preview');
      return;
    }
    setBalancedSyncGenerationId(null);
    setBalancedSyncPreviewUrl('');
    setBalancedSyncPreviewS3Key('');
    setBalancedSyncProgress(null);
    setShowBalancedPreview(false);
    const prev = prevAudioModeRef.current;
    prevAudioModeRef.current = null;
    if (prev) {
      setVoiceOverEnabled(prev.voiceOverEnabled);
      setOriginalAudioEnabled(prev.originalAudioEnabled);
      setVoiceOverPlaybackRate(prev.voiceOverPlaybackRate);
    }
  };

  const handleAcceptBalancedSync = async () => {
    setBalancedSyncError(null);
    if (!balancedSyncPreviewUrl || !balancedSyncPreviewS3Key) return;
    if (!workspaceS3Key || !voiceOverS3Key) {
      setBalancedSyncError('Original keys are missing; cannot accept.');
      return;
    }
    try {
      await balancedSyncAccept({
        originalVideoS3Key: workspaceS3Key,
        voiceOverS3Key,
        balancedVideoS3Key: balancedSyncPreviewS3Key,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBalancedSyncError(msg || 'Failed to accept balanced preview');
      return;
    }

    const urlWithKey = `${balancedSyncPreviewUrl}#wk=${encodeURIComponent(balancedSyncPreviewS3Key)}`;
    onVideoUrlChange?.(urlWithKey);
    onVideoNameChange?.('balanced-sync.mp4');
    // Switch preview to use the combined MP4's audio track.
    setVoiceOverAudioUrl('');
    setVoiceOverPlayableUrl('');
    setVoiceOverS3Key('');
    setVoiceOverEnabled(false);
    setOriginalAudioEnabled(true);
    setVoiceOverPlaybackRate(1);
    onVoiceOverAudioUrlChange?.('');
    onVoiceOverS3KeyChange?.('');
    onVoiceOverEnabledChange?.(false);
    onOriginalAudioEnabledChange?.(true);
    onVoiceOverPlaybackRateChange?.(1);
    try {
      // Some browsers can keep the muted flag from the prior voice-over mode; force audio back on.
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1;
      }
    } catch {
      /* ignore */
    }

    setBalancedSyncGenerationId(null);
    setBalancedSyncPreviewUrl('');
    setBalancedSyncPreviewS3Key('');
    setBalancedSyncProgress(null);
    setShowBalancedPreview(false);
    prevAudioModeRef.current = null;
  };

  const ensureSubtitlesEstimate = async () => {
    if (!workspaceS3Key) return;
    if (subtitlesEstimate || subtitlesEstimateLoading) return;
    setSubtitlesEstimateLoading(true);
    setSubtitlesEstimateError(null);
    try {
      const est = await subtitlesEstimatePointsFromExisting({ s3Key: workspaceS3Key, sourceType: 'video' });
      setSubtitlesEstimate(est);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubtitlesEstimateError(msg);
    } finally {
      setSubtitlesEstimateLoading(false);
    }
  };

  const startSubtitles = async () => {
    if (!workspaceS3Key) return;
    const subtitleTranslatedText = (translatedText.trim() || scriptText.trim()) || undefined;
    setSubtitlesError(null);
    setSubtitlesProgress({ percent: 10, label: 'Starting subtitles…' });
    try {
      const useSyncedVoiceSubs =
        Boolean(voiceOverEnabled && !originalAudioEnabled && voiceOverS3Key?.trim());
      const useOriginalAudioSyncRateForSubs =
        !useSyncedVoiceSubs && Math.abs(voiceOverPlaybackRate - 1) > 0.001;
      const complete = await subtitlesFromExisting({
        s3Key: workspaceS3Key,
        sourceType: 'video',
        targetLanguage: 'my',
        style: 'caption_rules_v1',
        translatedText: subtitleTranslatedText,
        ...(useSyncedVoiceSubs && voiceOverS3Key.trim()
          ? {
            voiceOverS3Key: voiceOverS3Key.trim(),
            voiceOverPlaybackRate: voiceOverPlaybackRate,
          }
          : {}),
        ...(useOriginalAudioSyncRateForSubs ? { voiceOverPlaybackRate: voiceOverPlaybackRate } : {}),
      });
      setSubtitlesGenerationId(complete.jobId);
      void onPersistWorkspaceSnapshot?.();
      subtitlesStreamRef.current = complete.jobId;
      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setSubtitlesProgress((prev) => mergeMonotonicJobProgress(prev, p));
        },
        onDone: () => {
          if (subtitlesStreamRef.current === complete.jobId) subtitlesStreamRef.current = null;
          setSubtitlesProgress((prev) => (prev && prev.percent < 100 ? null : prev));
        },
        onError: (msg) => {
          setSubtitlesError(msg);
          setSubtitlesProgress(null);
        },
        onTerminal: (payload) => applySubtitlesJobTerminal(complete.jobId, payload),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubtitlesError(msg);
      setSubtitlesProgress(null);
    }
  };

  const handleSubtitlesClick = () => {
    if (subtitlesEstimate && !subtitlesEstimateLoading && !subtitlesEstimateError) {
      setShowSubtitlesConfirm(true);
      return;
    }
    void startSubtitles();
  };
  const ensureTranslateEstimate = async () => {
    const text = transcriptText.trim();
    if (!text) return;
    if (translateEstimate || translateEstimateLoading) return;
    setTranslateEstimateLoading(true);
    setTranslateEstimateError(null);
    try {
      const est = await translateEstimatePoints(text);
      setTranslateEstimate(est);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTranslateEstimateError(msg);
    } finally {
      setTranslateEstimateLoading(false);
    }
  };

  const startTranscribe = async () => {
    if (!workspaceS3Key) return;
    setIsTranscribing(true);
    setIsGenerated(false);
    setTranscribeError(null);
    setTranscribeProgress({ percent: 10, label: 'Preparing upload…' });
    try {
      setTranscribeProgress({ percent: 35, label: 'Starting transcription…' });
      const complete = await transcribeFromExisting({
        s3Key: workspaceS3Key,
        sourceType: 'video',
        contentType: 'video/mp4',
        originalFileName: videoName || null,
      });
      setTranscribeGenerationId(complete.jobId);
      transcribeStreamRef.current = complete.jobId;

      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setTranscribeProgress((prev) => mergeMonotonicJobProgress(prev, p));
        },
        onDone: () => {
          if (transcribeStreamRef.current === complete.jobId) transcribeStreamRef.current = null;
          setTranscribeProgress((prev) => (prev && prev.percent < 100 ? null : prev));
        },
        onError: (msg) => {
          setTranscribeError(msg);
          setTranscribeProgress(null);
          if (transcribeStreamRef.current === complete.jobId) transcribeStreamRef.current = null;
          setTranscribeGenerationId(null);
        },
        onTerminal: (payload) => {
          const text = extractTranscriptTextFromOutputData(payload.outputData);
          if (text) {
            setIsTranscribed(true);
            setIsTranslated(false);
            setTranscriptText(text);
            setTranslatedText('');
            setScriptText(text);
            setTranscribeProgress({ percent: 100, label: 'Transcript ready' });
            window.setTimeout(() => setTranscribeProgress(null), PROGRESS_COMPLETION_FLASH_MS);
            if (transcribeStreamRef.current === complete.jobId) transcribeStreamRef.current = null;
            setTranscribeGenerationId(null);
          } else {
            const raw = payload.message ?? 'No transcript text returned.';
            setTranscribeError(raw);
            setTranscribeProgress(null);
            if (transcribeStreamRef.current === complete.jobId) transcribeStreamRef.current = null;
            setTranscribeGenerationId(null);
          }
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTranscribeError(msg);
      setTranscribeProgress(null);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranscribeClick = () => {
    const transcribeInProgress = isTranscribing || Boolean(transcribeProgress && transcribeProgress.percent < 100);
    if (transcribeInProgress || !workspaceS3Key || !videoMetadataReady) return;
    // If we have an estimate, show a confirmation modal before spending points.
    if (estimate && !estimateLoading && !estimateError) {
      setShowTranscribeConfirm(true);
      return;
    }
    void startTranscribe();
  };

  const handleTranslate = async () => {
    if (!isTranscribed) return;
    setIsTranslating(true);
    setIsGenerated(false);
    setTranslateGenerationId(null);
    setTranslateProgress({ percent: 12, label: 'Starting translation…' });
    lastTranslateSseAtRef.current = Date.now();
    try {
      const beginId = await translateBegin({
        text: transcriptText.trim(),
        sourceLanguage: 'English',
        targetLanguage: 'Burmese',
        style: tone,
      });
      setTranslateGenerationId(beginId);
      void onPersistWorkspaceSnapshot?.();
      openGenerationJobSseStream(beginId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) {
            lastTranslateSseAtRef.current = Date.now();
            setTranslateProgress((prev) => mergeMonotonicJobProgress(prev, p));
          }
        },
        onError: () => {
          setTranslateProgress((prev) => (prev && prev.percent < 100 ? null : prev));
        },
        onTerminal: () => {
          lastTranslateSseAtRef.current = Date.now();
          setTranslateProgress({ percent: 100, label: 'Translation complete' });
          window.setTimeout(() => setTranslateProgress(null), PROGRESS_COMPLETION_FLASH_MS);
        },
        onDone: () => {
          setTranslateProgress((prev) => (prev && prev.percent < 100 ? null : prev));
        },
      });
      const result = await translateExecute(beginId);
      const out = result.translatedText ?? '';
      setTranslatedText(out);
      setScriptText(out);
      setIsTranslated(Boolean(out.trim()));
      void onPersistWorkspaceSnapshot?.();
    } catch (e) {
      setTranslateProgress(null);
      throw e;
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateClick = () => {
    if (!isTranscribed || isTranslating || translateRecoveryBusy || (translateGenerationId != null && !translatedText.trim())) {
      return;
    }
    setShowTranslateConfirm(true);
    void ensureTranslateEstimate();
  };

  const handleGenerate = () => {
    if (!isTranslated) return;
    const text = scriptText.trim();
    if (!text) return;
    setShowVoiceOverConfirm(true);
  };

  const handleFinalExportClick = async () => {
    setExportEstimateError(null);
    setExportError(null);
    setExportedVideoUrl(null);
    setExportedVideoKey('');
    setShowExportDownloadNotice(false);
    try {
      const estimatedVideoSrcKey = extractWorkspaceKeyFromVideoUrl(String(videoUrl ?? '')) ?? workspaceS3Key ?? null;
      if (!estimatedVideoSrcKey) throw new Error('Video key is missing. Please re-upload the video.');
      setExportEstimateLoading(true);
      const est = await videoEditorExportEstimateExisting(estimatedVideoSrcKey);
      const reserve = Number((est as any).reserveCostPoints);
      setExportEstimate({ reserveCostPoints: Number.isFinite(reserve) ? reserve : 0 });
      setShowExportConfirm(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportEstimateError(msg || 'Failed to estimate export points');
    } finally {
      setExportEstimateLoading(false);
    }
  };

  const startFinalExport = async () => {
    setExportError(null);
    setExportedVideoUrl(null);
    setExportedVideoKey('');
    setShowExportDownloadNotice(false);
    setExporting(true);
    try {
      const v = videoRef.current;
      const duration = v?.duration;
      if (!duration || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('Video duration not ready. Play the video once, then try Export again.');
      }
      const baseUrl = String(videoUrl ?? '');
      const videoSrcKey = extractWorkspaceKeyFromVideoUrl(baseUrl) ?? workspaceS3Key ?? null;
      if (!videoSrcKey) {
        throw new Error('Video source key is missing. Please re-upload the video and try again.');
      }
      const noFrag = baseUrl.includes('#') ? baseUrl.slice(0, baseUrl.indexOf('#')) : baseUrl;
      const canvasW = Math.max(1, Math.round(previewFramePx.w));
      const canvasH = Math.max(1, Math.round(previewFramePx.h));
      const intrinsicW = previewIntrinsicPx?.w ?? v.videoWidth ?? 0;
      const intrinsicH = previewIntrinsicPx?.h ?? v.videoHeight ?? 0;
      if (intrinsicW <= 0 || intrinsicH <= 0) {
        throw new Error('Video dimensions not ready. Play the preview once, then try Export again.');
      }
      const displayToNaturalScale = viralDisplayToNaturalScale(canvasW, canvasH, intrinsicW, intrinsicH);

      const canMapPreviewFont =
        intrinsicW > 0 &&
        intrinsicH > 0 &&
        Number.isFinite(previewBurnedSubtitleFontPx) &&
        previewBurnedSubtitleFontPx > 0;

      /** Worker resolves object via `#wk=` fragment; prefer voice read URL host for bucket hint, fallback to video. */
      let voiceMixForExport:
        | { audioTracks: Array<Record<string, unknown>>; originalAudio: { muted: boolean; volume: number } }
        | undefined;
      const wantVoiceInExport =
        Boolean(voiceOverEnabled && !originalAudioEnabled && voiceOverS3Key?.trim());

      if (wantVoiceInExport) {
        const rawVoice = typeof voiceOverAudioUrl === 'string' ? voiceOverAudioUrl.trim() : '';
        const voiceBase =
          rawVoice !== ''
            ? rawVoice.includes('#')
              ? rawVoice.slice(0, rawVoice.indexOf('#'))
              : rawVoice
            : noFrag;
        voiceMixForExport = {
          originalAudio: { muted: true, volume: 100 },
          audioTracks: [
            {
              id: 'viral-voice-over',
              type: 'voiceover',
              src: `${voiceBase}#wk=${encodeURIComponent(voiceOverS3Key.trim())}`,
              startTime: 0,
              endTime: duration,
              volume: 100,
              fadeIn: 0,
              fadeOut: 0,
              playbackRate: voiceOverPlaybackRate,
            },
          ],
        };
      }

      // Export layers in the user-defined z-order: split by type but preserve relative order.
      // blurLayers in order → FFmpeg applies bottom-first; textLayers in order → ASS dialogue order.
      const orderedBlurForExport = overlayLayerOrder
        .filter((e) => e.type === 'blur')
        .map((e) => overlayBlurLayers.find((l) => l.id === e.id))
        .filter((l): l is NonNullable<typeof l> => l != null);
      const orderedTextForExport = overlayLayerOrder
        .filter((e) => e.type === 'text')
        .map((e) => overlayTextLayers.find((l) => l.id === e.id))
        .filter((l): l is NonNullable<typeof l> => l != null);

      // Same POST /api/v1/video-editor/workspace/export → processing WorkspaceExportService (FFmpeg) as full editor.
      const payload = {
        videoUrl: noFrag,
        videoSrcKey,
        workspaceS3Key: videoSrcKey,
        duration,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        displayToNaturalScale,
        textLayers: mapTextLayersForWorkspaceExport(orderedTextForExport),
        blurLayers: mapBlurLayersForWorkspaceExport(orderedBlurForExport),
        canvasFrame: { width: canvasW, height: canvasH },
        naturalVideo: { width: intrinsicW, height: intrinsicH },
        imageLayers: [],
        originalAudio: voiceMixForExport?.originalAudio ?? { muted: false, volume: 100 },
        ...(voiceMixForExport?.audioTracks ? { audioTracks: voiceMixForExport.audioTracks } : {}),
        protectFlip,
        protectHueDeg,
        burnSubtitles: Boolean(showSubtitlesOverlay && subtitlesSrtText.trim()),
        subtitlesSrtText: subtitlesSrtText,
        subtitlesPosition: subtitlesPosition,
        subtitlesFontSize: subtitlesFontSize,
        ...(canMapPreviewFont
          ? {
            subtitlesPreviewFontPx: previewBurnedSubtitleFontPx,
            subtitlesPreviewCanvasW: canvasW,
            subtitlesPreviewCanvasH: canvasH,
          }
          : {}),
        subtitlesBackgroundBlur: subtitlesBackgroundBlur,
        subtitlesBackgroundOpacity: subtitlesBackgroundOpacity,
      };
      const res = await exportVideoEditorWorkspace(payload);
      if (res.generationId != null) {
        setExportGenerationId(res.generationId);
        setExportProgress({ percent: 12, label: 'Queuing export…' });
        void onPersistWorkspaceSnapshot?.();
        const sseResult = await new Promise<{ downloadUrl: string; s3Key: string }>((resolve, reject) => {
          openGenerationJobSseStream(res.generationId!, {
            onStatus: (raw) => {
              const p = parseGenerationSseProgressPayload(raw, VIRAL_SHORTS_EXPORT_SSE_UI);
              if (p) setExportProgress((prev) => mergeMonotonicJobProgress(prev, p));
            },
            onDone: () => {
              setExportProgress((prev) => (prev && prev.percent < 100 ? null : prev));
            },
            onError: (message) => {
              reject(new Error(message || 'Export stream failed'));
            },
            onTerminal: (payload) => {
              if (payload.status !== 'completed') {
                reject(new Error(payload.message || 'Export failed'));
                return;
              }
              const { downloadUrl, s3Key } = extractExportResult(payload.outputData, {
                downloadUrl: res.downloadUrl,
                s3Key: res.s3Key,
              });
              if (!downloadUrl) {
                reject(new Error('Export completed but missing download URL'));
                return;
              }
              setExportProgress({ percent: 100, label: 'Export ready' });
              window.setTimeout(() => setExportProgress(null), PROGRESS_COMPLETION_FLASH_MS);
              resolve({ downloadUrl, s3Key });
            },
          });
        });
        setExportedVideoUrl(sseResult.downloadUrl);
        setExportedVideoKey(sseResult.s3Key);
        setExportGenerationId(null);
        await triggerWorkspaceExportDownload(sseResult.downloadUrl, sseResult.s3Key);
        setShowExportDownloadNotice(true);
      } else {
        setExportProgress({ percent: 100, label: 'Export ready' });
        window.setTimeout(() => setExportProgress(null), PROGRESS_COMPLETION_FLASH_MS);
        setExportedVideoUrl(res.downloadUrl);
        setExportedVideoKey(res.s3Key);
        await triggerWorkspaceExportDownload(res.downloadUrl, res.s3Key);
        setShowExportDownloadNotice(true);
      }
      await onExportSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(msg || 'Export failed');
      setShowExportDownloadNotice(false);
      setExportProgress(null);
    } finally {
      setExporting(false);
    }
  };

  const startVoiceOver = async () => {
    const text = scriptText.trim();
    if (!text) return;
    setIsGenerating(true);
    setIsGenerated(false);
    setVoiceOverError(null);
    setVoiceOverProgress({ percent: 10, label: tVo('progress.starting') });
    try {
      const started = await voiceOverStart({
        text,
        aiModel: selectedVoiceId,
        style: deliveryStyleForToneGroup(voiceToneGroupId),
      });
      setVoiceOverJobId(started.jobId);
      openVoiceOverSse(started.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setVoiceOverProgress((prev) => mergeMonotonicJobProgress(prev, p));
        },
        onDone: () => {
          setVoiceOverProgress((prev) => (prev && prev.percent < 100 ? null : prev));
        },
        onError: (msg) => {
          setVoiceOverError(msg);
          setVoiceOverProgress(null);
        },
        onTerminal: (payload) => {
          if (payload.status === 'completed' && payload.data && typeof payload.data === 'object') {
            const d = payload.data as Record<string, unknown>;
            const url = typeof d.audioUrl === 'string' ? d.audioUrl : '';
            const key = typeof d.s3Key === 'string' ? d.s3Key : '';
            if (url) {
              setVoiceOverProgress({ percent: 100, label: tVo('progress.finished') });
              window.setTimeout(() => setVoiceOverProgress(null), PROGRESS_COMPLETION_FLASH_MS);
              setVoiceOverAudioUrl(url);
              if (key) setVoiceOverS3Key(key);
              setIsGenerated(true);
              setVoiceOverEnabled(true);
              setOriginalAudioEnabled(false);
              setVoiceOverJobId(null);
              return;
            }
          }
          setVoiceOverError(payload.message ?? 'Voice over failed');
          setVoiceOverProgress(null);
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setVoiceOverError(msg);
      setVoiceOverProgress(null);
    } finally {
      setIsGenerating(false);
    }
  };

  /** Single status strip for transcribe / translate / voice / balanced sync / subtitles / export / media buffer. */
  const viralUnifiedJobBar = useMemo(() => {
    if (transcribeProgress != null && transcribeProgress.percent >= 100) {
      return {
        key: 'transcribe',
        title: 'Transcription',
        label: transcribeProgress.label,
        percent: 100,
        done: true,
        barClass: 'bg-violet-500',
      };
    }
    if (transcribeProgress != null && transcribeProgress.percent < 100) {
      const pct = transcribeProgress.percent;
      return {
        key: 'transcribe',
        title: 'Transcription',
        label: transcribeProgress.label,
        percent: pct,
        done: false,
        barClass: 'bg-violet-500',
      };
    }
    if (isTranscribing) {
      const tp = transcribeProgress;
      return {
        key: 'transcribe',
        title: 'Transcription',
        label: tp?.label ?? 'Preparing…',
        percent: typeof tp?.percent === 'number' && Number.isFinite(tp.percent) ? tp.percent : 22,
        done: false,
        barClass: 'bg-violet-500',
      };
    }
    if (translateProgress != null && translateProgress.percent >= 100) {
      return {
        key: 'translate',
        title: 'Translation',
        label: translateProgress.label,
        percent: 100,
        done: true,
        barClass: 'bg-sky-500',
      };
    }
    const translateStripActive =
      isTranslating ||
      translateRecoveryBusy ||
      (translateGenerationId != null && !translatedText.trim());
    if (translateStripActive) {
      let label = 'Translation in progress…';
      if (translateRecoveryBusy) label = 'Recovering translation…';
      else if (isTranslating) label = 'Translating script…';
      if (translateProgress?.label?.trim()) {
        label = translateProgress.label;
      }
      const pct =
        translateProgress != null
          ? translateProgress.percent
          : translateRecoveryBusy
            ? 20
            : isTranslating
              ? 16
              : 14;
      return {
        key: 'translate',
        title: 'Translation',
        label,
        percent: pct,
        done: false,
        barClass: 'bg-sky-500',
      };
    }
    if (voiceOverProgress != null && voiceOverProgress.percent >= 100) {
      return {
        key: 'voice',
        title: 'Voice over',
        label: voiceOverProgress.label,
        percent: 100,
        done: true,
        barClass: 'bg-violet-500',
      };
    }
    if (voiceOverProgress != null && voiceOverProgress.percent < 100) {
      const pct = voiceOverProgress.percent;
      return {
        key: 'voice',
        title: 'Voice over',
        label: voiceOverProgress.label,
        percent: pct,
        done: false,
        barClass: 'bg-violet-500',
      };
    }
    if (isGenerating) {
      return {
        key: 'voice',
        title: 'Voice over',
        label: 'Starting…',
        percent: 14,
        done: false,
        barClass: 'bg-violet-500',
      };
    }
    if (balancedSyncProgress != null && balancedSyncProgress.percent >= 100) {
      return {
        key: 'balanced',
        title: 'Balanced sync',
        label: balancedSyncProgress.label,
        percent: 100,
        done: true,
        barClass: 'bg-amber-500',
      };
    }
    if (balancedSyncProgress != null && balancedSyncProgress.percent < 100) {
      const pct = balancedSyncProgress.percent;
      return {
        key: 'balanced',
        title: 'Balanced sync',
        label: balancedSyncProgress.label,
        percent: pct,
        done: false,
        barClass: 'bg-amber-500',
      };
    }
    if (subtitlesProgress != null && subtitlesProgress.percent >= 100) {
      return {
        key: 'subtitles',
        title: 'Subtitles',
        label: subtitlesProgress.label,
        percent: 100,
        done: true,
        barClass: 'bg-cyan-500',
      };
    }
    const subtitlesWorkPending =
      subtitlesGenerationId != null && (!subtitlesSrtText.trim() || !subtitlesDownloadUrl.trim());
    const subtitlesBarActive =
      (subtitlesProgress != null && subtitlesProgress.percent < 100) || subtitlesWorkPending;
    if (subtitlesBarActive) {
      const pctFromStream =
        subtitlesProgress != null && subtitlesProgress.percent < 100
          ? subtitlesProgress.percent
          : subtitlesWorkPending
            ? 22
            : 10;
      const labelFromStream =
        subtitlesProgress != null && subtitlesProgress.percent < 100 ? subtitlesProgress.label : null;
      return {
        key: 'subtitles',
        title: 'Subtitles',
        label: labelFromStream ?? (subtitlesWorkPending ? 'Subtitles in progress…' : 'Subtitles'),
        percent: pctFromStream,
        done: false,
        barClass: 'bg-cyan-500',
      };
    }
    if (exportProgress != null && exportProgress.percent >= 100) {
      return {
        key: 'export',
        title: 'Export',
        label: exportProgress.label,
        percent: 100,
        done: true,
        barClass: 'bg-emerald-500',
      };
    }
    if (exporting || (Boolean(exportGenerationId) && !exportedVideoUrl)) {
      const ep = exportProgress;
      return {
        key: 'export',
        title: 'Export',
        label: ep?.label ?? 'Rendering final video…',
        percent: ep != null ? ep.percent : -1,
        done: false,
        barClass: 'bg-emerald-500',
      };
    }
    if (!videoMetadataReady || (Boolean(voiceOverAudioUrl) && !voiceMetadataReady)) {
      const vPct = Math.round(videoBufferPct * 100);
      const aPct = Math.round(audioBufferPct * 100);
      const blended = voiceOverAudioUrl
        ? Math.round((videoBufferPct + audioBufferPct) * 50)
        : vPct;
      return {
        key: 'buffer',
        title: 'Preparing media',
        label: voiceOverAudioUrl ? `Video ${vPct}% · Voice ${aPct}%` : `Video ${vPct}%`,
        percent: Math.min(99, Math.max(0, blended)),
        done: false,
        barClass: 'bg-violet-500',
      };
    }
    return null;
  }, [
    transcribeProgress,
    isTranscribing,
    isTranslating,
    translateRecoveryBusy,
    translateGenerationId,
    translatedText,
    translateProgress,
    voiceOverProgress,
    isGenerating,
    balancedSyncProgress,
    subtitlesProgress,
    subtitlesGenerationId,
    subtitlesSrtText,
    subtitlesDownloadUrl,
    exporting,
    exportGenerationId,
    exportProgress,
    exportedVideoUrl,
    videoMetadataReady,
    voiceMetadataReady,
    voiceOverAudioUrl,
    videoBufferPct,
    audioBufferPct,
  ]);
  const isSyncingVoice = syncUi.kind === 'working';
  const isBalancedSyncRunning = Boolean(balancedSyncProgress && balancedSyncProgress.percent < 100);
  const isSubtitlesRunning = Boolean(
    (subtitlesProgress && subtitlesProgress.percent < 100) ||
    (subtitlesGenerationId != null &&
      (!subtitlesSrtText.trim() || !subtitlesDownloadUrl.trim())),
  );
  const isExportPipelineBusy = exporting || (exportGenerationId != null && !exportedVideoUrl);
  const isAnyTaskRunning =
    Boolean(transcribeProgress && transcribeProgress.percent < 100) ||
    isTranscribing ||
    isTranslating ||
    translateRecoveryBusy ||
    (translateGenerationId != null && !translatedText.trim()) ||
    Boolean(voiceOverProgress && voiceOverProgress.percent < 100) ||
    isGenerating ||
    isSyncingVoice ||
    isBalancedSyncRunning ||
    isSubtitlesRunning ||
    isExportPipelineBusy;

  return (
    <section className="viral-studio-shell overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-violet-500/15 dark:bg-[#12101e] dark:shadow-[0_24px_56px_rgba(0,0,0,0.45)]">
      <header className="viral-studio-header flex items-center justify-between border-b border-violet-200/50 bg-white px-3 py-2.5 dark:border-violet-500/15 dark:bg-zinc-900/70">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-foreground">
          <Subtitles className="h-4 w-4 text-[#b9a4ff]" aria-hidden />
          AI Video Editor
        </div>
        <div className="flex items-center gap-2">
          {typeof onDiscardWorkspace === 'function' ? (
            <button
              type="button"
              onClick={onDiscardWorkspace}
              className="viral-studio-discard h-8 rounded-md border bg-transparent px-3 text-xs font-semibold transition-colors"
            >
              {tEditor('buttons.discardWorkspace')}
            </button>
          ) : null}
          <ActionButton
            onClick={() => void handleFinalExportClick()}
            isLoading={isExportPipelineBusy}
            disabled={!workspaceS3Key || isAnyTaskRunning}
            label={tEditor('buttons.finalExport')}
            loadingLabel={tEditor('buttons.exporting')}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      </header>

      {viralUnifiedJobBar ? (
        <div
          className="viral-studio-job-bar border-b border-violet-200/50 bg-white px-3 py-2.5 lg:px-4 dark:border-violet-500/15 dark:bg-zinc-900/40"
          role="status"
          aria-live="polite"
          aria-label={`${viralUnifiedJobBar.title}: ${viralUnifiedJobBar.label}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {viralUnifiedJobBar.title}
            </p>
            <p
              className={`text-[11px] font-semibold tabular-nums ${viralUnifiedJobBar.done ? 'text-emerald-400' : 'text-muted-foreground'
                }`}
            >
              {viralUnifiedJobBar.percent >= 0 ? `${viralUnifiedJobBar.percent}%` : '…'}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-foreground">{viralUnifiedJobBar.label}</p>
          <ProgressBar
            value={viralUnifiedJobBar.percent >= 0 ? viralUnifiedJobBar.percent : 0}
            max={100}
            ariaLabel={`${viralUnifiedJobBar.title}: ${viralUnifiedJobBar.label}`}
            isComplete={viralUnifiedJobBar.done}
            className="!mt-2 !bg-white ring-1 ring-inset ring-zinc-200 dark:!bg-white/10 dark:ring-white/15"
            fillClassName={viralUnifiedJobBar.barClass}
            completeFillClassName={viralUnifiedJobBar.barClass}
            indeterminate={viralUnifiedJobBar.percent < 0}
            indeterminateFillClassName={`w-[40%] max-w-[12rem] animate-pulse ${viralUnifiedJobBar.barClass}`}
          />
        </div>
      ) : null}

      <div className="grid min-h-[640px] grid-cols-1 auto-rows-auto lg:grid-cols-[minmax(300px,420px)_1fr] lg:grid-rows-[auto_1fr]">
        <aside className="viral-studio-sidebar scrollbar-themed flex min-h-0 flex-col border-b border-violet-200/50 bg-white p-3 lg:col-start-1 lg:row-start-1 lg:border-b-0 lg:border-r lg:p-4 dark:border-violet-500/15 dark:bg-zinc-950/50">
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTranscribeClick}
              disabled={
                isAnyTaskRunning ||
                isTranscribing ||
                Boolean(transcribeProgress && transcribeProgress.percent < 100) ||
                !workspaceS3Key ||
                !videoMetadataReady
              }
              className="btn-transcribe"
            >
              {isTranscribing || Boolean(transcribeProgress && transcribeProgress.percent < 100)
                ? tEditor('buttons.transcribing')
                : tEditor('buttons.transcribeVideo')}
            </button>
            {transcribeError ? (
              <div className="viral-studio-error rounded border px-2 py-1.5 text-[10px] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {transcribeError}
              </div>
            ) : null}
          </div>

          <div className="viral-studio-script-card mt-6 rounded-md border border-violet-200/50 bg-white p-2 dark:border-violet-500/15 dark:bg-transparent">
            <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold uppercase text-muted">
              <button
                type="button"
                onClick={() => setLeftTab('script')}
                disabled={isAnyTaskRunning}
                className={`rounded px-2 py-1 text-center transition-colors ${leftTab === 'script' ? 'bg-white text-violet-800 ring-2 ring-violet-400/50 dark:bg-violet-500/20 dark:text-foreground dark:ring-violet-400/40' : 'bg-white text-zinc-600 ring-1 ring-violet-200/80 hover:ring-violet-300/50 dark:bg-white/5 dark:text-muted dark:ring-transparent dark:hover:bg-white/10'
                  }`}
              >
                {tEditor('buttons.scriptTab')}
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('srt')}
                disabled={isAnyTaskRunning}
                className={`rounded px-2 py-1 text-center transition-colors ${leftTab === 'srt' ? 'bg-white text-violet-800 ring-2 ring-violet-400/50 dark:bg-violet-500/20 dark:text-foreground dark:ring-violet-400/40' : 'bg-white text-zinc-600 ring-1 ring-violet-200/80 hover:ring-violet-300/50 dark:bg-white/5 dark:text-muted dark:ring-transparent dark:hover:bg-white/10'
                  }`}
              >
                {tEditor('buttons.srtEditorTab')}
              </button>
            </div>
            <div className="mt-2 space-y-1.5 bg-white dark:bg-transparent">
              {leftTab === 'script' && transcriptRows.length > 0 ? (
                <div className="viral-studio-muted-surface rounded border border-violet-200/50 bg-white px-2 py-1.5 text-[10px] text-muted dark:border-violet-500/15 dark:bg-zinc-900/40">
                  {transcriptRows[0].start} - {transcriptRows[transcriptRows.length - 1].end}
                </div>
              ) : null}
              {leftTab === 'script' ? (
                <textarea
                  value={scriptText}
                  disabled={isAnyTaskRunning}
                  onChange={(e) => {
                    const v = e.target.value;
                    setScriptText(v);
                    if (isTranslated) {
                      setTranslatedText(v);
                    } else {
                      setTranscriptText(v);
                    }
                  }}
                  placeholder={tEditor('labels.scriptPlaceholder')}
                  className="min-h-[220px] w-full resize-y rounded border border-violet-200/50 bg-white px-2 py-2 text-[11px] leading-snug text-foreground outline-none dark:border-violet-500/15 dark:bg-zinc-900/40"
                />
              ) : (
                <>
                  <div className="viral-studio-srt-settings space-y-2 rounded border border-violet-200/50 bg-[#ffffff] p-2 text-[10px] text-foreground dark:border-violet-500/15 dark:bg-zinc-900/40">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold tabular-nums text-foreground">{editableCues.length} cues</span>
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={showSubtitlesOverlay}
                          disabled={isAnyTaskRunning}
                          onChange={(e) => setShowSubtitlesOverlay(e.target.checked)}
                          className="shrink-0"
                        />
                        <span>{tEditor('labels.showOnVideo')}</span>
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={subtitlesEditPosition}
                          disabled={!showSubtitlesOverlay || isAnyTaskRunning}
                          onChange={(e) => setSubtitlesEditPosition(e.target.checked)}
                          className="shrink-0"
                        />
                        <span>{tEditor('labels.moveOnVideo')}</span>
                      </label>
                    </div>
                    <div className="grid gap-2 border-t border-card-border/60 pt-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {tEditor('labels.fontSizeExport')}
                        </p>
                        <p className="text-[9px] leading-snug text-muted-foreground/90">
                          Preview scales this to your clip so on-screen size matches burned export.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center overflow-hidden rounded border border-violet-200/50 bg-white dark:border-violet-500/15 dark:bg-zinc-900/40">
                            <button
                              type="button"
                              className="h-7 w-7 border-r border-card-border text-[13px] font-semibold text-foreground hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
                              onClick={() => setSubtitlesFontSize((v) => Math.max(14, v - 1))}
                              disabled={subtitlesFontSize <= 14 || isAnyTaskRunning}
                              aria-label="Decrease subtitle size"
                            >
                              –
                            </button>
                            <input
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={String(subtitlesFontSize)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d]/g, '');
                                if (!raw) return;
                                const n = Math.max(14, Math.min(60, Number(raw)));
                                if (Number.isFinite(n)) setSubtitlesFontSize(n);
                              }}
                              onBlur={(e) => {
                                const n = Math.max(14, Math.min(60, Number(e.target.value) || 22));
                                setSubtitlesFontSize(Number.isFinite(n) ? n : 22);
                              }}
                              className="h-7 w-9 bg-transparent text-center text-[11px] font-semibold text-foreground outline-none"
                              aria-label="Subtitle size"
                            />
                            <button
                              type="button"
                              className="h-7 w-7 border-l border-card-border text-[13px] font-semibold text-foreground hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
                              onClick={() => setSubtitlesFontSize((v) => Math.min(60, v + 1))}
                              disabled={subtitlesFontSize >= 60 || isAnyTaskRunning}
                              aria-label="Increase subtitle size"
                            >
                              +
                            </button>
                          </div>
                          <select
                            value={String(subtitlesFontSize)}
                            disabled={isAnyTaskRunning}
                            onChange={(e) => {
                              const n = Math.max(14, Math.min(60, Number(e.target.value) || 22));
                              setSubtitlesFontSize(Number.isFinite(n) ? n : 22);
                            }}
                            className="h-7 rounded border border-violet-200/50 bg-white px-1.5 text-[10px] font-semibold text-foreground outline-none hover:border-violet-400/60 hover:bg-white dark:border-violet-500/15 dark:bg-zinc-900/40 dark:hover:bg-white/5"
                            aria-label="Preset subtitle sizes"
                          >
                            {[14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 60].map((n) => (
                              <option key={n} value={String(n)}>
                                {n}px
                              </option>
                            ))}
                          </select>
                          <span
                            className="inline-flex min-h-[1.5rem] min-w-[2rem] items-center justify-center rounded border border-card-border bg-black/60 px-1 font-semibold text-white"
                            style={{
                              fontSize: `${Math.min(20, Math.max(8, previewBurnedSubtitleFontPx))}px`,
                              lineHeight: 1.1,
                            }}
                            title="Sample at preview scale (matches video overlay)"
                          >
                            Aa
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {tEditor('labels.backgroundOpacity')}
                        </p>
                        <p className="text-[9px] leading-snug text-muted-foreground/90">
                          Same value is applied to the burned export (black box alpha).
                        </p>
                        <label className="flex items-center gap-2 pt-0.5">
                          <span className="w-10 shrink-0 text-foreground/80">Opacity</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={subtitlesBackgroundOpacity}
                            disabled={isAnyTaskRunning}
                            onChange={(e) => {
                              const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              setSubtitlesBackgroundOpacity(Number.isFinite(n) ? n : 0);
                            }}
                            className="h-2 min-w-0 flex-1 accent-[#7c5cff]"
                            aria-label="Subtitle background opacity"
                          />
                          <span className="w-10 shrink-0 text-right tabular-nums text-foreground/80">{subtitlesBackgroundOpacity}%</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="viral-studio-srt-editor flex min-h-0 max-h-[min(420px,48vh)] flex-col gap-2 bg-white dark:bg-transparent">
                    <div className="viral-studio-srt-scroll viral-studio-muted-surface scrollbar-themed min-h-0 flex-1 overflow-auto rounded border border-violet-200/50 bg-white p-1.5 dark:border-violet-400/10 dark:bg-zinc-900/40">
                      {editableCues.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted">{tEditor('labels.generateSubtitlesFirst')}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {editableCues.slice(0, 80).map((c) => (
                            <div
                              key={c.id}
                              data-cue-id={c.id}
                              onClick={() => setSelectedSrtCueId((prev) => (prev === c.id ? null : c.id))}
                              className={`viral-srt-cue-card rounded-md border bg-white px-2 py-1.5 cursor-pointer transition-colors ${selectedSrtCueId === c.id
                                ? 'viral-srt-cue-card--selected border-violet-400 !bg-white ring-2 ring-violet-500/30 dark:border-violet-500/50 dark:bg-violet-500/15 dark:ring-violet-500/25'
                                : 'border-violet-200/70 hover:border-violet-400/50 hover:ring-1 hover:ring-violet-400/20 dark:border-violet-400/10 dark:bg-zinc-900/40 dark:hover:border-violet-400/25 dark:hover:bg-zinc-900/60'
                                }`}
                            >
                              <div className="flex flex-wrap items-start gap-2 bg-white dark:bg-transparent">
                                <label className="min-w-[7.5rem] flex-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                                  Start
                                  <input
                                    value={formatSrtTimestamp(c.startTime)}
                                    disabled={isAnyTaskRunning}
                                    onChange={(e) => {
                                      const next = parseTimeInput(e.target.value);
                                      if (next == null) return;
                                      setEditableCues((prev) =>
                                        prev.map((x) =>
                                          x.id === c.id ? { ...x, startTime: Math.max(0, next) } : x,
                                        ),
                                      );
                                    }}
                                    className="mt-0.5 h-7 w-full rounded border border-violet-500/25 bg-white px-1.5 font-mono text-[10px] text-foreground outline-none focus:border-violet-500/70 focus:bg-white focus:ring-0 dark:border-violet-400/20 dark:bg-zinc-900/40 dark:focus:bg-zinc-900/40"
                                  />
                                </label>
                                <label className="min-w-[7.5rem] flex-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                                  End
                                  <input
                                    value={formatSrtTimestamp(c.endTime)}
                                    disabled={isAnyTaskRunning}
                                    onChange={(e) => {
                                      const next = parseTimeInput(e.target.value);
                                      if (next == null) return;
                                      setEditableCues((prev) =>
                                        prev.map((x) =>
                                          x.id === c.id ? { ...x, endTime: Math.max(next, x.startTime + 0.05) } : x,
                                        ),
                                      );
                                    }}
                                    className="mt-0.5 h-7 w-full rounded border border-violet-500/25 bg-white px-1.5 font-mono text-[10px] text-foreground outline-none focus:border-violet-500/70 focus:bg-white focus:ring-0 dark:border-violet-400/20 dark:bg-zinc-900/40 dark:focus:bg-zinc-900/40"
                                  />
                                </label>
                                <div className="ml-auto flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    className="viral-srt-add-after-btn h-7 appearance-none rounded border border-violet-500/25 bg-[#ffffff] px-2 text-[10px] font-semibold text-foreground hover:border-violet-400/60 hover:bg-[#ffffff] dark:border-violet-400/20 dark:bg-zinc-900/40 dark:hover:bg-white/5"
                                    disabled={isAnyTaskRunning}
                                    onClick={() => {
                                      const nextStart = Math.max(0, c.endTime);
                                      const nextEnd = nextStart + 1.6;
                                      const id = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                                      setEditableCues((prev) => {
                                        const idx = prev.findIndex((x) => x.id === c.id);
                                        const nextCue: EditableSrtCue = {
                                          id,
                                          startTime: nextStart,
                                          endTime: nextEnd,
                                          content: '',
                                        };
                                        if (idx < 0) return [...prev, nextCue];
                                        return [...prev.slice(0, idx + 1), nextCue, ...prev.slice(idx + 1)];
                                      });
                                    }}
                                  >
                                    {tEditor('buttons.addAfter')}
                                  </button>
                                  <button
                                    type="button"
                                    className="h-7 rounded border border-red-500/35 bg-transparent px-2 text-[10px] font-semibold text-red-300 hover:bg-red-500/10"
                                    disabled={isAnyTaskRunning}
                                    onClick={() => setEditableCues((prev) => prev.filter((x) => x.id !== c.id))}
                                  >
                                    {tEditor('buttons.remove')}
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 rounded-lg border-2 border-dashed border-[#7c5cff]/40 bg-white p-2 dark:bg-white/5 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
                                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Cue text
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">Drag corner to resize box</span>
                                </div>
                                <textarea
                                  value={c.content}
                                  disabled={isAnyTaskRunning}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditableCues((prev) =>
                                      prev.map((x) => (x.id === c.id ? { ...x, content: v } : x)),
                                    );
                                  }}
                                  rows={3}
                                  className="box-border min-h-[5.5rem] w-full resize-y rounded-md border border-violet-500/25 bg-white px-2.5 py-2 text-[12px] leading-relaxed text-foreground outline-none ring-0 transition-shadow focus:border-violet-500/70 focus:bg-white focus:shadow-[0_0_0_2px_rgba(124,92,255,0.25)] dark:border-violet-400/20 dark:bg-zinc-900/40 dark:focus:bg-zinc-900/40 dark:focus:shadow-[0_0_0_1px_rgba(124,92,255,0.35)]"
                                />
                              </div>
                            </div>
                          ))}
                          {editableCues.length > 80 ? (
                            <p className="px-1 py-0.5 text-[10px] text-muted">Showing first 80 cues.</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {editableCues.length > 0 ? (
                      <div className="viral-srt-save-footer shrink-0 rounded border border-violet-200/50 bg-white px-2 py-1.5 dark:border-violet-400/15 dark:bg-zinc-900/40">
                        <button
                          type="button"
                          className="h-8 w-full rounded-md bg-[#7c5cff] text-[11px] font-semibold text-white transition-colors hover:bg-[#6b4bff]"
                          disabled={isAnyTaskRunning}
                          onClick={() => {
                            srtSyncFromTableRef.current = true;
                            setSubtitlesSrtText(cuesToSrt(editableCues));
                          }}
                        >
                          {tEditor('buttons.saveAllCuesToSrt')}
                        </button>
                        <p className="mt-1 text-center text-[9px] leading-tight text-muted-foreground">
                          Applies every cue above to the workspace subtitle file.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <details className="viral-studio-advanced-srt rounded border border-violet-200/50 bg-white p-2 dark:border-violet-500/15 dark:bg-zinc-900/40">
                    <summary className="viral-studio-advanced-srt-summary cursor-pointer list-none bg-white text-[10px] font-semibold text-muted marker:content-none dark:bg-zinc-900/40 [&::-webkit-details-marker]:hidden">
                      Advanced: edit raw .srt
                    </summary>
                    <textarea
                      value={subtitlesSrtText}
                      disabled={isAnyTaskRunning}
                      onChange={(e) => setSubtitlesSrtText(e.target.value)}
                      placeholder="Raw .srt text…"
                      className="mt-2 min-h-[160px] w-full resize-y rounded border border-violet-200/50 bg-white dark:border-violet-500/15 dark:bg-zinc-900/40 p-2 text-[11px] leading-snug text-foreground outline-none focus:border-violet-400"
                    />
                  </details>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="viral-studio-stage flex min-h-0 flex-col border-b border-violet-200/50 bg-white lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:border-b-0 dark:border-violet-500/15 dark:bg-zinc-950/40">

          <div className="viral-studio-preview-bar flex shrink-0 items-center justify-between border-b border-violet-200/50 px-3 py-2 text-[11px] text-zinc-600 dark:border-violet-500/15 dark:text-zinc-400">
            <span>Editing Mode</span>
            <span>{isGenerated ? `Voiceover ready: ${voiceLabel}` : 'No Project Loaded'}</span>
          </div>
          <div
            ref={previewSlotRef}
            className="viral-studio-preview-slot flex min-h-[min(320px,42vh)] w-full flex-1 items-center justify-center overflow-hidden border-b border-violet-200/50 bg-white p-2 dark:border-violet-500/15 dark:bg-black/30"
          >
            {/* Wrapper absorbs the scaled size so the slot doesn't collapse */}
            <div
              style={{
                width: Math.round(previewFramePx.w * previewScale),
                height: Math.round(previewFramePx.h * previewScale),
              }}
              className="flex shrink-0 items-center justify-center"
            >
              <div
                className="relative shrink-0 overflow-hidden rounded-lg border border-violet-500/20 bg-black dark:border-violet-400/15"
                style={{
                  width: Math.round(previewFramePx.w),
                  height: Math.round(previewFramePx.h),
                  isolation: 'isolate',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'center center',
                }}
              >
                <video
                  ref={videoRef}
                  src={isBalancedPreviewMode ? balancedSyncPreviewUrl : videoUrl}
                  controls
                  playsInline
                  preload="auto"
                  className="block h-full w-full object-contain"
                  style={{
                    transform: protectFlip ? 'scaleX(-1)' : undefined,
                    filter: protectHueDeg ? `hue-rotate(${protectHueDeg}deg)` : undefined,
                  }}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    const iw = el.videoWidth;
                    const ih = el.videoHeight;
                    if (iw > 0 && ih > 0) setPreviewIntrinsicPx({ w: iw, h: ih });
                    const dur = el.duration;
                    if (Number.isFinite(dur) && dur > 0) {
                      setOverlayPreviewDuration(dur);
                    }
                  }}
                  onTimeUpdate={(e) => setPreviewPlaybackTime(e.currentTarget.currentTime)}
                  onPlay={() => setPreviewIsPlaying(true)}
                  onPause={() => setPreviewIsPlaying(false)}
                />
                {/* Render all overlay layers (blur + text) in unified z-order so preview matches timeline order */}
                {overlayLayerOrder.map((entry, i) => {
                  if (entry.type === 'blur') {
                    const layer = overlayBlurLayers.find((l) => l.id === entry.id);
                    if (!layer) return null;
                    return (
                      <ViralBlurLayer
                        key={layer.id}
                        layer={layer}
                        currentTimeSec={previewPlaybackTime}
                        stackIndex={i}
                        scale={previewScale}
                      />
                    );
                  }
                  if (entry.type === 'text') {
                    const layer = overlayTextLayers.find((l) => l.id === entry.id);
                    if (!layer) return null;
                    return (
                      <ViralTextLayer
                        key={layer.id}
                        layer={layer}
                        currentTimeSec={previewPlaybackTime}
                        stackIndex={i}
                        scale={previewScale}
                      />
                    );
                  }
                  return null;
                })}
                {/* SRT subtitle overlay — always on top of blur/text overlays (highest z) */}
                {showSubtitlesOverlay && activeSubtitleText.trim() ? (
                  <div
                    className="absolute"
                    style={{
                      left: `${Math.round(subtitlesPosition.x * 1000) / 10}%`,
                      top: `${Math.round(subtitlesPosition.y * 1000) / 10}%`,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: subtitlesEditPosition ? 'auto' : 'none',
                      zIndex: 95,
                    }}
                    onPointerDown={(e) => {
                      if (!subtitlesEditPosition) return;
                      const el = e.currentTarget.parentElement;
                      if (!el) return;
                      subtitleDragRef.current = {
                        active: true,
                        startX: e.clientX,
                        startY: e.clientY,
                        baseX: subtitlesPosition.x,
                        baseY: subtitlesPosition.y,
                      };
                      (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerMove={(e) => {
                      const d = subtitleDragRef.current;
                      if (!subtitlesEditPosition || !d?.active) return;
                      const el = e.currentTarget.parentElement;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const dx = (e.clientX - d.startX) / Math.max(1, rect.width);
                      const dy = (e.clientY - d.startY) / Math.max(1, rect.height);
                      setSubtitlesPosition({
                        x: Math.max(0, Math.min(1, d.baseX + dx)),
                        y: Math.max(0, Math.min(1, d.baseY + dy)),
                      });
                      e.preventDefault();
                    }}
                    onPointerUp={() => {
                      if (!subtitleDragRef.current) return;
                      subtitleDragRef.current.active = false;
                    }}
                  >
                    <div
                      className="max-w-[92%] rounded-lg px-3 py-2 text-center font-semibold text-white"
                      style={{
                        fontSize: `${previewBurnedSubtitleFontPx}px`,
                        lineHeight: 1.25,
                        backgroundColor: `rgba(0, 0, 0, ${subtitlesBackgroundOpacity / 100})`,
                      }}
                      title={
                        previewIntrinsicPx
                          ? `Preview ${Math.round(previewBurnedSubtitleFontPx)}px → burn ~${previewSubtitleFontPxToFfmpegFontPx(
                            previewBurnedSubtitleFontPx,
                            Math.max(1, Math.round(previewFramePx.w)),
                            Math.max(1, Math.round(previewFramePx.h)),
                            previewIntrinsicPx.w,
                            previewIntrinsicPx.h,
                          )}px at ${previewIntrinsicPx.w}×${previewIntrinsicPx.h}`
                          : `Burn-in (slider): ${subtitlesFontSize}px — load preview to map to output`
                      }
                    >
                      {activeSubtitleText}
                    </div>
                    {/* {subtitlesEditPosition ? (
                    <div className="mt-1 text-center text-[10px] font-semibold text-white/80">Drag to move</div>
                  ) : null} */}
                  </div>
                ) : null}
                {isBalancedPreviewMode ? (
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white">
                    <span className="font-semibold">All set — synced preview on deck</span>
                    <button
                      type="button"
                      onClick={() => setShowBalancedPreview(true)}
                      disabled={isAnyTaskRunning}
                      className="h-7 rounded-md bg-[#7c5cff] px-2 font-semibold text-white hover:bg-[#6b4bff]"
                    >
                      {tEditor('buttons.previewAndAccept')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <ViralOverlayInspector
            activeTool={overlayActiveTool}
            onActiveTool={setOverlayActiveTool}
            selectedText={selectedOverlayText}
            selectedBlur={selectedOverlayBlur}
            durationReady={overlayPreviewDuration > 0}
            onAddText={() => addOverlayTextAtPlayhead(previewPlaybackTime)}
            onAddBlur={() => addOverlayBlurAtPlayhead(previewPlaybackTime)}
            onUpdateText={updateOverlayText}
            onUpdateBlur={updateOverlayBlur}
            onDelete={() => deleteOverlaySelected()}
          />

          <div className="viral-studio-timeline-section flex min-h-[220px] min-w-0 shrink-0 flex-col border-b border-violet-200/50 bg-white lg:min-h-[200px] lg:flex-1 dark:border-violet-500/15 dark:bg-zinc-950/30">
            <p className="viral-studio-timeline-heading border-b border-violet-200/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-violet-500/15 dark:text-zinc-400">
              {tOverlays('timelineTitle')}
            </p>
            <ViralTimelineDock
              phase={overlayPreviewDuration > 0 ? 'ready' : 'loading'}
              durationSec={overlayPreviewDuration}
              currentTimeSec={previewPlaybackTime}
              isPlaying={previewIsPlaying}
              textLayers={overlayTextLayers}
              blurLayers={overlayBlurLayers}
              selectedLayerId={overlaySelectedId}
              srtCues={editableCues.length > 0 ? (editableCues as SrtCueForTimeline[]) : undefined}
              selectedSrtCueId={selectedSrtCueId}
              layerOrder={overlayLayerOrder}
              onMoveLayerUp={moveOverlayLayerUp}
              onMoveLayerDown={moveOverlayLayerDown}
              videoLabel={videoName.trim() || tOverlays('videoClip')}
              emptyLabel={tOverlays('timelineEmpty')}
              loadingLabel={tOverlays('timelineLoading')}
              playLabel={tOverlays('play')}
              pauseLabel={tOverlays('pause')}
              prevLabel={tOverlays('skipBack')}
              nextLabel={tOverlays('skipForward')}
              onTogglePlay={togglePreviewPlayback}
              onSeekBy={seekPreviewBy}
              onSeekRatio={seekPreviewRatio}
              onSelectClip={(id) => {
                setOverlaySelectedId(id);
                // Auto-switch tool to match the selected layer type (CapCut-style)
                const isText = overlayTextLayers.some((l) => l.id === id);
                const isBlur = overlayBlurLayers.some((l) => l.id === id);
                if (isText) setOverlayActiveTool('text');
                else if (isBlur) setOverlayActiveTool('blur');
              }}
              onDeselect={() => setOverlaySelectedId(null)}
              onUpdateTextTiming={(id, patch) => updateOverlayText(id, patch)}
              onUpdateBlurTiming={(id, patch) => updateOverlayBlur(id, patch)}
              onSelectSrtCue={(id) => {
                setSelectedSrtCueId(id);
                // Switch to SRT tab so the user sees the cue highlighted
                setLeftTab('srt');
              }}
              onUpdateSrtCueTiming={(id, patch) => {
                setEditableCues((prev) => {
                  const next = prev.map((c) =>
                    c.id === id
                      ? {
                        ...c,
                        startTime: patch.startTime ?? c.startTime,
                        endTime: patch.endTime ?? c.endTime,
                      }
                      : c,
                  );
                  // Sync back to the SRT text so export/burn uses updated times
                  srtSyncFromTableRef.current = true;
                  setSubtitlesSrtText(cuesToSrt(next));
                  return next;
                });
              }}
            />
          </div>

          {!isBalancedPreviewMode ? (
            <div className="viral-studio-stage-foot border-b border-violet-200/50 px-3 py-10 text-[11px] text-muted dark:border-violet-500/15">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="viral-audio-mode"
                    checked={originalAudioEnabled}
                    disabled={isAnyTaskRunning}
                    onChange={() => {
                      setOriginalAudioEnabled(true);
                      setVoiceOverEnabled(false);
                      try {
                        if (videoRef.current) {
                          videoRef.current.muted = false;
                          if (!Number.isFinite(videoRef.current.volume) || videoRef.current.volume <= 0) {
                            videoRef.current.volume = 1;
                          }
                        }
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                  Original sound
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="viral-audio-mode"
                    checked={voiceOverEnabled}
                    disabled={!voiceOverAudioUrl || isAnyTaskRunning}
                    onChange={() => {
                      setVoiceOverEnabled(true);
                      setOriginalAudioEnabled(false);
                    }}
                  />
                  Voice over
                </label>
                {voiceOverEnabled ? (
                  <span className="text-[10px] text-muted">Voice speed: {voiceOverPlaybackRate.toFixed(2)}×</span>
                ) : null}
              </div>
              {/* Single source of truth: this audio element is BOTH the visible player and the synced track. */}
              {voiceOverAudioUrl ? (
                <audio
                  ref={voiceRef}
                  src={voiceOverPlayableUrl || voiceOverAudioUrl}
                  preload="auto"
                  controls
                  className="mt-3 w-full"
                  onError={async () => {
                    // If the presigned URL expired while user stays on page, refresh it using the stable s3Key.
                    if (!voiceOverS3Key) return;
                    try {
                      const fresh = await voiceOverPresignRead(voiceOverS3Key);
                      if (fresh && fresh !== voiceOverAudioUrl) {
                        setVoiceOverAudioUrl(fresh);
                        setVoiceOverError(null);
                      }
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : String(e);
                      setVoiceOverError(msg || 'Failed to refresh voice over URL');
                    }
                  }}
                />
              ) : null}
            </div>
          ) : null}

          <div className="viral-studio-stage-foot border-b border-violet-200/50 px-3 py-3 text-[11px] text-muted dark:border-violet-500/15">
            Edit the script in the left column (Script / SRT).
          </div>

          <div className="viral-studio-stage-foot px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted">
              <Play className="h-3.5 w-3.5" aria-hidden />
              <span>
                {isGenerating
                  ? 'Generating Burmese voiceover...'
                  : isTranslated
                    ? 'Burmese script is ready. Click Generate.'
                    : isTranscribed
                      ? 'English script is ready. Click Translate to convert to Burmese.'
                      : `Loaded: ${videoName}`}
              </span>
              {(isTranscribing || isTranslating || isGenerating) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
            </div>
            {exportError ? (
              <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-200">
                {exportError}
              </div>
            ) : null}
            {exportedVideoUrl && showExportDownloadNotice ? (
              <div className="mb-2 rounded border border-violet-200/50 bg-white dark:border-violet-500/15 dark:bg-zinc-900/40 px-2 py-1.5 text-[10px] text-muted">
                Export saved — your browser should have downloaded the file.{' '}
                <button
                  type="button"
                  className="font-semibold text-foreground underline"
                  disabled={isAnyTaskRunning}
                  onClick={() => void triggerWorkspaceExportDownload(exportedVideoUrl, exportedVideoKey || 'video-export.mp4')}
                >
                  {tEditor('buttons.downloadAgain')}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="viral-studio-sidebar scrollbar-themed flex min-h-0 flex-col border-t border-violet-200/50 bg-white p-3 lg:col-start-1 lg:row-start-2 lg:border-t lg:border-r lg:p-4 dark:border-violet-500/15 dark:bg-zinc-950/50">
          <div className="space-y-4 pt-1">
            <div className="viral-studio-panel rounded-xl border border-violet-200/50 p-4 dark:border-violet-500/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {tViral('translateSectionTitle')}
              </p>
              <div className="mt-3 flex flex-row items-stretch gap-3">
                <div className="min-w-0 flex-1 basis-0">
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as TranslateTone)}
                    className="viral-translate-tone-select box-border block h-10 w-full min-w-0 rounded-lg border border-violet-200/50 bg-white px-3 pr-9 text-sm text-zinc-900 outline-none dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground"
                  >
                    <option value="casual_social_media">Casual / Social Media (spoken)</option>
                    <option value="polite_educational">Polite & Educational (spoken)</option>
                    <option value="formal_corporate">Formal / Corporate (literary)</option>
                    <option value="youthful_trendy">Youthful / Trendy (Gen Z)</option>
                  </select>
                </div>
                <ActionButton
                  onClick={handleTranslateClick}
                  isLoading={isTranslating}
                  disabled={!isTranscribed || isTranslating || isAnyTaskRunning}
                  label={tEditor('buttons.translate')}
                  loadingLabel={tEditor('buttons.translating')}
                  className="btn-viral-shorts-analyze btn-viral-shorts-translate-inline h-10 shrink-0 rounded-xl px-5 text-sm font-semibold whitespace-nowrap"
                />
              </div>
            </div>

            <div className="viral-studio-panel space-y-4 rounded-xl border border-violet-200/50 p-4 dark:border-violet-500/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{tViral('sectionTitle')}</p>

              <div className="viral-studio-voice-row flex items-stretch gap-3 rounded-lg border border-violet-200/50 bg-white px-3 py-2.5 dark:border-violet-500/15 dark:bg-zinc-900/40">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {tViral('voiceStyleKicker')}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                    {voiceModelsLoading
                      ? '…'
                      : `${tVo(`toneGroups.${voiceToneGroupId}.title`)} · ${formatVoiceIdDisplay(selectedVoiceId)}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="viral-studio-secondary-btn shrink-0 self-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground dark:hover:bg-white/5"
                  onClick={() => setShowVoiceStyleModal(true)}
                  disabled={voiceModelsLoading || isGenerating || isAnyTaskRunning}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {voiceModelsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {voiceModelsLoading ? tEditor('buttons.loading') : tViral('chooseVoiceStyleButton')}
                  </span>
                </button>
              </div>

              <ActionButton
                onClick={() => void handleGenerate()}
                isLoading={isGenerating}
                disabled={!isTranslated || isGenerating || isAnyTaskRunning}
                label={tEditor('buttons.generate')}
                loadingLabel={tEditor('buttons.generating')}
                className="btn-viral-shorts h-11 w-full rounded-xl px-4 text-sm font-semibold"
              />

              {voiceOverError ? (
                <p className="text-xs leading-relaxed text-red-400">{voiceOverError}</p>
              ) : null}

              <div className="space-y-3 border-t border-violet-200/50 pt-4 dark:border-violet-500/15">
                <button
                  type="button"
                  onClick={() => void handleSyncVoiceToVideo()}
                  disabled={
                    isAnyTaskRunning ||
                    isSyncingVoice || !videoMetadataReady || (Boolean(voiceOverAudioUrl) && !voiceMetadataReady)
                  }
                  className="viral-studio-secondary-btn flex min-h-11 w-full items-center justify-center rounded-lg border px-3 py-2.5 text-center text-[11px] font-semibold leading-snug transition-colors disabled:cursor-not-allowed dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground dark:hover:bg-white/5"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isSyncingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {isSyncingVoice ? tEditor('buttons.syncingVoiceLength') : tEditor('buttons.syncVoiceLengthToAudio')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleBalancedSyncClick()}
                  disabled={
                    isAnyTaskRunning ||
                    isBalancedPreviewMode ||
                    !voiceOverAudioUrl ||
                    !voiceOverS3Key ||
                    !videoMetadataReady ||
                    !voiceMetadataReady ||
                    isBalancedSyncRunning ||
                    balancedSyncEstimateLoading
                  }
                  className="viral-studio-secondary-btn flex min-h-11 w-full items-center justify-center rounded-lg border px-3 py-2.5 text-center text-[11px] font-semibold leading-snug transition-colors disabled:cursor-not-allowed dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground dark:hover:bg-white/5"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isBalancedSyncRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {isBalancedSyncRunning
                      ? tEditor('buttons.renderingBalancedSync')
                      : tEditor('buttons.balancedSyncRenderCombine')}
                  </span>
                </button>
                {balancedSyncEstimateError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                    {balancedSyncEstimateError}
                  </div>
                ) : null}
                {balancedSyncError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                    {balancedSyncError}
                  </div>
                ) : null}
                {isBalancedPreviewMode && !showBalancedPreview ? (
                  <button
                    type="button"
                    onClick={() => setShowBalancedPreview(true)}
                    disabled={isAnyTaskRunning}
                    className="flex min-h-11 w-full items-center justify-center rounded-lg border border-[#7c5cff]/40 bg-[#7c5cff]/10 px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-[#7c5cff]/20 disabled:opacity-50"
                  >
                    {tEditor('buttons.viewBalancedPreview')}
                  </button>
                ) : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-0.5 py-1 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={allowStrongerSync}
                    disabled={isAnyTaskRunning}
                    onChange={(e) => setAllowStrongerSync(e.target.checked)}
                  />
                  <span>Allow stronger sync (may sound less natural)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !(protectFlip || protectHueDeg > 0);
                    setProtectFlip(next);
                    setProtectHueDeg(next ? 25 : 0);
                  }}
                  disabled={isAnyTaskRunning}
                  className="viral-studio-secondary-btn flex min-h-11 w-full items-center justify-center rounded-lg border px-3 py-2.5 text-center text-[11px] font-semibold leading-snug transition-colors dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground dark:hover:bg-white/5"
                >
                  {tEditor('buttons.protectionFlipHue')}
                </button>
                {syncUi.kind !== 'idle' ? (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${syncUi.kind === 'error'
                      ? 'border-red-500/30 bg-red-500/10 text-red-200'
                      : syncUi.kind === 'warn'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        : 'border-violet-200/50 bg-white text-muted dark:border-violet-500/15 dark:bg-zinc-900/40'
                      }`}
                  >
                    {syncUi.message}
                  </div>
                ) : null}
                <button
                  type="button"
                  onMouseEnter={() => void ensureSubtitlesEstimate()}
                  onFocus={() => void ensureSubtitlesEstimate()}
                  onClick={handleSubtitlesClick}
                  disabled={!workspaceS3Key || isSubtitlesRunning || isAnyTaskRunning}
                  className="viral-studio-secondary-btn flex min-h-11 w-full items-center justify-center rounded-lg border px-3 py-2.5 text-center text-[11px] font-semibold leading-snug transition-colors disabled:cursor-not-allowed dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground dark:hover:bg-white/5"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isSubtitlesRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {isSubtitlesRunning ? tEditor('buttons.generatingSubtitles') : tEditor('buttons.generateSubtitles')}
                  </span>
                </button>
                {subtitlesError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                    {subtitlesError}
                  </div>
                ) : null}
                {subtitlesDownloadUrl ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center justify-center rounded-lg bg-[#7c5cff] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#6b4bff]"
                      disabled={isAnyTaskRunning}
                      onClick={() => {
                        void (async () => {
                          let nextUrl = subtitlesDownloadUrl;
                          try {
                            if (subtitlesGenerationId) {
                              const d = await fetchSubtitleDownloadUrl(subtitlesGenerationId);
                              if (d?.downloadUrl) {
                                nextUrl = d.downloadUrl;
                                setSubtitlesDownloadUrl(d.downloadUrl);
                                setSubtitlesSrtKey(d.srtKey || '');
                              }
                            }
                          } catch {
                            // Signed URL refresh failed; fall back to existing cached URL.
                          }

                          try {
                            // Match subtitles page behavior (download attribute) and avoid popup blockers.
                            const a = document.createElement('a');
                            a.href = nextUrl;
                            a.download = '';
                            a.rel = 'noreferrer';
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                          } catch {
                            // Last-resort: do nothing (no user-facing "expiry" messaging).
                          }
                        })();
                      }}
                    >
                      {tEditor('buttons.downloadSrt')}
                    </button>
                    <button
                      type="button"
                      className="viral-studio-secondary-btn flex min-h-10 w-full items-center justify-center rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors dark:border-violet-500/15 dark:bg-zinc-900/40 dark:text-foreground dark:hover:bg-white/5"
                      disabled={isAnyTaskRunning}
                      onClick={() => setLeftTab('srt')}
                    >
                      {tEditor('buttons.openSrtEditor')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {showTranscribeConfirm ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm transcription"
          onMouseDown={() => setShowTranscribeConfirm(false)}
        >
          <div
            className="viral-modal-panel w-full max-w-md rounded-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Transcribe this video?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will use{' '}
              <span className="font-semibold text-foreground">{estimate?.reserveCostPoints ?? '—'}</span> points to
              generate a transcript for your viral workspace.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowTranscribeConfirm(false)}
              >
                {tEditor('buttons.cancel')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                disabled={
                  isAnyTaskRunning ||
                  isTranscribing ||
                  Boolean(transcribeProgress && transcribeProgress.percent < 100) ||
                  !workspaceS3Key ||
                  !videoMetadataReady
                }
                onClick={() => {
                  setShowTranscribeConfirm(false);
                  void startTranscribe();
                }}
              >
                {tEditor('buttons.continue')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTranslateConfirm ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm translation"
          onMouseDown={() => setShowTranslateConfirm(false)}
        >
          <div
            className="viral-modal-panel w-full max-w-md rounded-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Translate this transcript?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will translate your transcript and use{' '}
              <span className="font-semibold text-foreground">
                {translateEstimateLoading ? '…' : translateEstimate?.reserveCostPoints ?? '—'}
              </span>{' '}
              points.
            </p>
            {translateEstimateError ? (
              <p className="mt-2 text-sm text-red-300">{translateEstimateError}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowTranslateConfirm(false)}
              >
                {tEditor('buttons.cancel')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                disabled={!isTranscribed || isTranslating || translateEstimateLoading || isAnyTaskRunning}
                onClick={() => {
                  setShowTranslateConfirm(false);
                  void handleTranslate();
                }}
              >
                {tEditor('buttons.continue')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSubtitlesConfirm ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm subtitles"
          onMouseDown={() => setShowSubtitlesConfirm(false)}
        >
          <div
            className="viral-modal-panel w-full max-w-md rounded-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Generate subtitles?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will generate subtitles for your video and use{' '}
              <span className="font-semibold text-foreground">
                {subtitlesEstimateLoading ? '…' : subtitlesEstimate?.reserveCostPoints ?? '—'}
              </span>{' '}
              points.
            </p>
            {subtitlesEstimateError ? <p className="mt-2 text-sm text-red-300">{subtitlesEstimateError}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowSubtitlesConfirm(false)}
              >
                {tEditor('buttons.cancel')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                disabled={subtitlesEstimateLoading || isSubtitlesRunning || isAnyTaskRunning}
                onClick={() => {
                  setShowSubtitlesConfirm(false);
                  void startSubtitles();
                }}
              >
                {isSubtitlesRunning ? tEditor('buttons.generatingSubtitles') : tEditor('buttons.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showExportConfirm ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm export"
          onMouseDown={() => setShowExportConfirm(false)}
        >
          <div
            className="viral-modal-panel w-full max-w-md rounded-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Export final video?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will export your current edits (protection + subtitles if enabled) and use{' '}
              <span className="font-semibold text-foreground">
                {exportEstimateLoading ? '…' : exportEstimate?.reserveCostPoints ?? '—'}
              </span>{' '}
              points.
            </p>
            {exportEstimateError ? <p className="mt-2 text-sm text-red-300">{exportEstimateError}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowExportConfirm(false)}
              >
                {tEditor('buttons.cancel')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                disabled={exportEstimateLoading || isAnyTaskRunning}
                onClick={() => {
                  setShowExportConfirm(false);
                  void startFinalExport();
                }}
              >
                {tEditor('buttons.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showVoiceStyleModal ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-style-modal-title"
          onMouseDown={() => setShowVoiceStyleModal(false)}
        >
          <div
            className="viral-modal-panel flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="viral-modal-divider border-b px-4 py-3">
              <p id="voice-style-modal-title" className="text-sm font-semibold text-foreground">
                {tViral('voiceStyleModalTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{tViral('voiceStyleModalSubtitle')}</p>
            </div>
            <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 dark:bg-zinc-950">
              <VoiceToneVoicePicker
                catalog={voiceModelCatalog}
                loading={voiceModelsLoading}
                error={voiceModelsError}
                toneGroupId={voiceToneGroupId}
                onToneGroupChange={setVoiceToneGroupId}
                selectedVoiceId={selectedVoiceId}
                onVoiceIdChange={setSelectedVoiceId}
                disabled={isGenerating || isAnyTaskRunning}
              />
            </div>
            <div className="viral-modal-divider flex justify-end border-t px-4 py-3">
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff]"
                onClick={() => setShowVoiceStyleModal(false)}
              >
                {tViral('voiceStyleModalDone')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showVoiceOverConfirm ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm voice over"
          onMouseDown={() => setShowVoiceOverConfirm(false)}
        >
          <div
            className="viral-modal-panel w-full max-w-md rounded-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Generate voice over?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will generate an audio voice over for your script and use{' '}
              <span className="font-semibold text-foreground">
                {voiceOverEstimateLoading ? '…' : voiceOverPointsEstimate?.reserveCostPoints ?? '—'}
              </span>{' '}
              points.
            </p>
            {voiceOverEstimateError ? (
              <p className="mt-2 text-sm text-red-300">{voiceOverEstimateError}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowVoiceOverConfirm(false)}
              >
                {tEditor('buttons.cancel')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                disabled={!isTranslated || isGenerating || isAnyTaskRunning}
                onClick={() => {
                  setShowVoiceOverConfirm(false);
                  void startVoiceOver();
                }}
              >
                {tEditor('buttons.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBalancedSyncConfirm ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm balanced sync"
          onMouseDown={() => setShowBalancedSyncConfirm(false)}
        >
          <div
            className="viral-modal-panel w-full max-w-md rounded-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Render balanced sync?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will create a combined video preview and use{' '}
              <span className="font-semibold text-foreground">
                {balancedSyncEstimateLoading ? '…' : balancedSyncPointsEstimate?.reserveCostPoints ?? '—'}
              </span>{' '}
              points.
            </p>
            {balancedSyncEstimateError ? (
              <p className="mt-2 text-sm text-red-300">{balancedSyncEstimateError}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowBalancedSyncConfirm(false)}
              >
                {tEditor('buttons.cancel')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                disabled={balancedSyncEstimateLoading || isBalancedSyncRunning || isAnyTaskRunning}
                onClick={() => {
                  setShowBalancedSyncConfirm(false);
                  void handleStartBalancedSync();
                }}
              >
                {isBalancedSyncRunning ? tEditor('buttons.renderingBalancedSync') : tEditor('buttons.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBalancedPreview && isBalancedPreviewMode ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Balanced sync preview"
        >
          <div className="viral-modal-panel w-full max-w-3xl overflow-hidden rounded-2xl">
            <div className="viral-modal-divider flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Balanced sync preview</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Listen carefully — accept only if it feels aligned.
                </p>
              </div>
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowBalancedPreview(false)}
              >
                {tEditor('buttons.close')}
              </button>
            </div>
            <div className="bg-black p-3">
              <video
                src={balancedSyncPreviewUrl}
                controls
                playsInline
                preload="auto"
                className="mx-auto h-[420px] w-full max-w-[900px] rounded-lg object-contain"
              />
            </div>
            <div className="viral-modal-divider flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
              <button
                type="button"
                className="viral-studio-secondary-btn h-9 rounded-md border px-3 text-xs font-semibold transition-colors dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => void handleRejectBalancedSync()}
              >
                {tEditor('buttons.reject')}
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff]"
                onClick={() => void handleAcceptBalancedSync()}
              >
                {tEditor('buttons.accept')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
