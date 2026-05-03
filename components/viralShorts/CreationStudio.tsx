'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Play, Subtitles } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';
import ProgressBar from '@/components/shared/components/progress-bar';
import {
  transcribeEstimatePointsFromExisting,
  transcribeFromExisting,
  type PointsEstimate,
} from '@/lib/transcribe-api';
import { translateEstimatePoints, translateText, type PointsEstimate as TranslatePointsEstimate } from '@/lib/translate-api';
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
  openGenerationJobSseStream,
  parseGenerationSseProgressPayload,
} from '@/lib/generation-job-sse';
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

type Props = {
  videoUrl: string;
  videoName: string;
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
  initialTranslatedText?: string;
  initialTone?: TranslateTone;
  initialVoiceOverAudioUrl?: string;
  initialVoiceOverS3Key?: string;
  /** Persisted Gemini voice id (e.g. {@code kore}); legacy {@code woman-kore}/{@code man} normalized on load. */
  initialVoiceOverVoice?: string;
  initialVoiceOverEnabled?: boolean;
  initialOriginalAudioEnabled?: boolean;
  initialVoiceOverPlaybackRate?: number;
  initialAllowStrongerSync?: boolean;
  initialProtectFlip?: boolean;
  initialProtectHueDeg?: number;
  onTranscriptTextChange?: (text: string) => void;
  onTranslatedTextChange?: (text: string) => void;
  onToneChange?: (tone: TranslateTone) => void;
  onVoiceOverAudioUrlChange?: (url: string) => void;
  onVoiceOverS3KeyChange?: (key: string) => void;
  onVoiceOverVoiceChange?: (voiceId: string) => void;
  onVoiceOverEnabledChange?: (enabled: boolean) => void;
  onOriginalAudioEnabledChange?: (enabled: boolean) => void;
  onVoiceOverPlaybackRateChange?: (rate: number) => void;
  onAllowStrongerSyncChange?: (enabled: boolean) => void;
  onProtectFlipChange?: (enabled: boolean) => void;
  onProtectHueDegChange?: (deg: number) => void;
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
  onDiscardWorkspace?: () => void;
  /** Persist viral workspace to the server right after export (avoids losing state if URLs refresh). */
  onExportSuccess?: () => void | Promise<void>;
};

export default function CreationStudio({
  videoUrl,
  videoName,
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
  initialTranslatedText,
  initialTone,
  initialVoiceOverAudioUrl,
  initialVoiceOverS3Key,
  initialVoiceOverVoice,
  initialVoiceOverEnabled,
  initialOriginalAudioEnabled,
  initialVoiceOverPlaybackRate,
  initialAllowStrongerSync,
  initialProtectFlip,
  initialProtectHueDeg,
  onTranscriptTextChange,
  onTranslatedTextChange,
  onToneChange,
  onVoiceOverAudioUrlChange,
  onVoiceOverS3KeyChange,
  onVoiceOverVoiceChange,
  onVoiceOverEnabledChange,
  onOriginalAudioEnabledChange,
  onVoiceOverPlaybackRateChange,
  onAllowStrongerSyncChange,
  onProtectFlipChange,
  onProtectHueDegChange,
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
  onDiscardWorkspace,
  onExportSuccess,
}: Props) {
  const tVo = useTranslations('voice-over');
  const tViral = useTranslations('viralShorts.voiceStudio');
  const tEditor = useTranslations('viralShorts.editor');
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
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedVideoKey, setExportedVideoKey] = useState('');

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
  const [subtitlesEditPosition, setSubtitlesEditPosition] = useState(false);
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

  useEffect(() => {
    if (srtSyncFromTableRef.current) {
      srtSyncFromTableRef.current = false;
      return;
    }
    try {
      const base = subtitlesSrtText ? parseSrt(subtitlesSrtText) : [];
      setEditableCues(base.map((c, i) => ({ ...c, id: `c_${i}_${Math.random().toString(16).slice(2)}` })));
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

    const calc = () => {
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) {
        setVideoMetadataReady(true);
      } else {
        return;
      }
      let end = 0;
      try {
        if (v.buffered && v.buffered.length > 0) {
          end = v.buffered.end(v.buffered.length - 1);
        }
      } catch {
        end = 0;
      }
      const pct = Math.max(0, Math.min(1, end / d));
      setVideoBufferPct(pct);
      if (pct >= 0.995) {
        setVideoFullyLoaded(true);
      }
    };

    const onProgress = () => calc();
    const onMeta = () => calc();
    const onCanPlayThrough = () => {
      // Some browsers signal this when it *expects* full playback without buffering.
      // We still prefer buffered check, but this is a good hint.
      calc();
      setVideoFullyLoaded(true);
    };

    v.addEventListener('progress', onProgress);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('canplaythrough', onCanPlayThrough);
    const tmr = window.setInterval(calc, 400);
    calc();

    return () => {
      window.clearInterval(tmr);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('durationchange', onMeta);
      v.removeEventListener('canplaythrough', onCanPlayThrough);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  useEffect(() => {
    setAudioBufferPct(0);
    setVoiceFullyLoaded(false);
    setVoiceMetadataReady(false);
    if (!voiceOverPlayableUrl && !voiceOverAudioUrl) return;

    const a = voiceRef.current;
    if (!a) return;

    const calc = () => {
      const d = a.duration;
      if (Number.isFinite(d) && d > 0) {
        setVoiceMetadataReady(true);
      } else {
        return;
      }
      let end = 0;
      try {
        if (a.buffered && a.buffered.length > 0) {
          end = a.buffered.end(a.buffered.length - 1);
        }
      } catch {
        end = 0;
      }
      const pct = Math.max(0, Math.min(1, end / d));
      setAudioBufferPct(pct);
      if (pct >= 0.995) {
        setVoiceFullyLoaded(true);
      }
    };

    const onProgress = () => calc();
    const onMeta = () => calc();
    const onCanPlayThrough = () => {
      calc();
      setVoiceFullyLoaded(true);
    };

    a.addEventListener('progress', onProgress);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('canplaythrough', onCanPlayThrough);
    const tmr = window.setInterval(calc, 400);
    calc();

    return () => {
      window.clearInterval(tmr);
      a.removeEventListener('progress', onProgress);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('canplaythrough', onCanPlayThrough);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const previewFramePx = useMemo(() => {
    const maxW = Math.max(1, previewSlotPx.w);
    const maxH = Math.max(1, Math.min(previewSlotPx.h, STUDIO_PREVIEW_MAX_VIDEO_HEIGHT_PX));
    if (!previewIntrinsicPx || previewIntrinsicPx.w <= 0 || previewIntrinsicPx.h <= 0) {
      return fitVideoDisplayRect(16, 9, maxW, maxH);
    }
    return fitVideoDisplayRect(previewIntrinsicPx.w, previewIntrinsicPx.h, maxW, maxH);
  }, [previewSlotPx, previewIntrinsicPx]);

  /** ASS burn-in uses FontSize in video pixel space (PlayResY = frame height). Match preview CSS px to that. */
  const previewBurnedSubtitleFontPx = useMemo(() => {
    const vh = previewIntrinsicPx?.h;
    if (!vh || vh <= 0 || !Number.isFinite(subtitlesFontSize)) return subtitlesFontSize;
    const scale = previewFramePx.h / vh;
    return Math.max(4, subtitlesFontSize * scale);
  }, [previewIntrinsicPx, previewFramePx.h, subtitlesFontSize]);

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
    v.muted = wantVoice;
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
        void a.play().catch(() => {});
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
      if (!v.paused && a.paused) void a.play().catch(() => {});
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
      void a.play().catch(() => {});
    }

    // Auto-clear the message after a bit.
    window.setTimeout(() => {
      setSyncUi((prev) => (prev.kind === 'working' ? prev : { kind: 'idle', message: '' }));
    }, 3500);
  };

  const handleStartBalancedSync = async () => {
    setBalancedSyncError(null);
    setBalancedSyncProgress({ percent: 8, label: 'Starting balanced sync…' });
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
          setBalancedSyncProgress({ percent: 12, label: 'Connected…' });
        },
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setBalancedSyncProgress(p);
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
          setBalancedSyncProgress({ percent: 100, label: 'Balanced preview ready' });
          setShowBalancedPreview(true);
        },
        onError: (message) => {
          setBalancedSyncError(message || 'Balanced sync stream error');
          setBalancedSyncProgress(null);
        },
        onDone: () => {
          // no-op
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
      await balancedSyncReject({ balancedVideoS3Key: balancedSyncPreviewS3Key });
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
    onVoiceOverAudioUrlChange?.('');
    onVoiceOverS3KeyChange?.('');
    onVoiceOverEnabledChange?.(false);
    onOriginalAudioEnabledChange?.(true);
    onVoiceOverPlaybackRateChange?.(1);

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
      const complete = await subtitlesFromExisting({
        s3Key: workspaceS3Key,
        sourceType: 'video',
        targetLanguage: 'my',
        style: 'caption_rules_v1',
        translatedText: subtitleTranslatedText,
      });
      setSubtitlesGenerationId(complete.jobId);
      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setSubtitlesProgress(p);
        },
        onDone: () => {},
        onError: (msg) => {
          setSubtitlesError(msg);
          setSubtitlesProgress(null);
        },
        onTerminal: (payload) => {
          if (payload.status !== 'completed') {
            setSubtitlesError(payload.message || 'Subtitles job failed');
            setSubtitlesProgress(null);
            return;
          }
          setSubtitlesProgress({ percent: 100, label: 'Subtitles ready' });
          void fetchSubtitleDownloadUrl(complete.jobId)
            .then((d) => {
              setSubtitlesDownloadUrl(d.downloadUrl);
              setSubtitlesSrtKey(d.srtKey);
            })
            .catch((e) => {
              const msg = e instanceof Error ? e.message : String(e);
              setSubtitlesError(msg);
            });

          void fetchSubtitleSrtText(complete.jobId)
            .then((d) => {
              setSubtitlesSrtText(d.srtText);
            })
            .catch((e) => {
              const msg = e instanceof Error ? e.message : String(e);
              setSubtitlesError(msg);
            });
        },
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

      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setTranscribeProgress(p);
        },
        onDone: () => {},
        onError: (msg) => {
          setTranscribeError(msg);
          setTranscribeProgress(null);
        },
        onTerminal: (payload) => {
          const text = extractTranscriptTextFromOutputData(payload.outputData);
          if (text) {
            setIsTranscribed(true);
            setIsTranslated(false);
            setTranscriptText(text);
            setTranslatedText('');
            setScriptText(text);
            setTranscribeProgress(null);
          } else {
            const raw = payload.message ?? 'No transcript text returned.';
            setTranscribeError(raw);
            setTranscribeProgress(null);
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
    try {
      const result = await translateText({
        text: transcriptText.trim(),
        sourceLanguage: 'English',
        targetLanguage: 'Burmese',
        style: tone,
      });
      const out = result.translatedText ?? '';
      setTranslatedText(out);
      setScriptText(out);
      setIsTranslated(Boolean(out.trim()));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateClick = () => {
    if (!isTranscribed || isTranslating) return;
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
      const canMapPreviewFont =
        intrinsicW > 0 &&
        intrinsicH > 0 &&
        Number.isFinite(previewBurnedSubtitleFontPx) &&
        previewBurnedSubtitleFontPx > 0;

      const payload = {
        videoUrl: noFrag,
        videoSrcKey,
        workspaceS3Key: videoSrcKey,
        duration,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        displayToNaturalScale: { x: 1, y: 1 },
        textLayers: [],
        imageLayers: [],
        originalAudio: { muted: false, volume: 100 },
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
        const exportSseOverrides = {
          subscribedLabel: 'Export queued',
          subscribedPercent: 18,
          stages: {
            workspace_export_started: { percent: 28, label: 'Rendering timeline' },
            workspace_export_encoding: { percent: 62, label: 'Encoding video' },
            workspace_export_uploading: { percent: 88, label: 'Uploading result' },
          },
        } as const;
        const sseResult = await new Promise<{ downloadUrl: string; s3Key: string }>((resolve, reject) => {
          openGenerationJobSseStream(res.generationId!, {
            onStatus: (raw) => {
              const p = parseGenerationSseProgressPayload(raw, exportSseOverrides);
              if (p) {
                // keep stream active and parse progress, but avoid adding new UI state
                void p;
              }
            },
            onDone: () => {},
            onError: (message) => {
              reject(new Error(message || 'Export stream failed'));
            },
            onTerminal: (payload) => {
              if (payload.status !== 'completed') {
                reject(new Error(payload.message || 'Export failed'));
                return;
              }
              const output =
                typeof payload.outputData === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(payload.outputData) as Record<string, unknown>;
                      } catch {
                        return undefined;
                      }
                    })()
                  : payload.outputData != null && typeof payload.outputData === 'object'
                    ? (payload.outputData as Record<string, unknown>)
                    : undefined;
              const resultNode =
                output && typeof output.result === 'object' && output.result != null
                  ? (output.result as Record<string, unknown>)
                  : undefined;
              const pick = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
              const downloadUrl =
                pick(resultNode?.readUrl) ||
                pick(resultNode?.downloadUrl) ||
                pick(resultNode?.storageUrl) ||
                (output ? pick(output.readUrl) || pick(output.downloadUrl) || pick(output.storageUrl) : '') ||
                pick(res.downloadUrl) ||
                '';
              const s3Key = pick(resultNode?.s3Key) || pick(res.s3Key) || '';
              if (!downloadUrl) {
                reject(new Error('Export completed but missing download URL'));
                return;
              }
              resolve({ downloadUrl, s3Key });
            },
          });
        });
        setExportedVideoUrl(sseResult.downloadUrl);
        setExportedVideoKey(sseResult.s3Key);
        await triggerWorkspaceExportDownload(sseResult.downloadUrl, sseResult.s3Key);
      } else {
        setExportedVideoUrl(res.downloadUrl);
        setExportedVideoKey(res.s3Key);
        await triggerWorkspaceExportDownload(res.downloadUrl, res.s3Key);
      }
      await onExportSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(msg || 'Export failed');
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
      openVoiceOverSse(started.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) setVoiceOverProgress(p);
        },
        onDone: () => {},
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
              setVoiceOverAudioUrl(url);
              if (key) setVoiceOverS3Key(key);
              setIsGenerated(true);
              setVoiceOverProgress(null);
              setVoiceOverEnabled(true);
              setOriginalAudioEnabled(false);
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
    // Completed jobs often leave progress at 100% — ignore so later steps (e.g. voice over) still show.
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
      return {
        key: 'transcribe',
        title: 'Transcription',
        label: 'Preparing…',
        percent: -1,
        done: false,
        barClass: 'bg-violet-500',
      };
    }
    if (isTranslating) {
      return {
        key: 'translate',
        title: 'Translation',
        label: 'Translating script…',
        percent: -1,
        done: false,
        barClass: 'bg-sky-500',
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
        percent: -1,
        done: false,
        barClass: 'bg-violet-500',
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
    if (subtitlesProgress != null && subtitlesProgress.percent < 100) {
      const pct = subtitlesProgress.percent;
      return {
        key: 'subtitles',
        title: 'Subtitles',
        label: subtitlesProgress.label,
        percent: pct,
        done: false,
        barClass: 'bg-cyan-500',
      };
    }
    if (exporting) {
      return {
        key: 'export',
        title: 'Export',
        label: 'Rendering final video…',
        percent: -1,
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
        barClass: 'bg-zinc-400',
      };
    }
    return null;
  }, [
    transcribeProgress,
    isTranscribing,
    isTranslating,
    voiceOverProgress,
    isGenerating,
    balancedSyncProgress,
    subtitlesProgress,
    exporting,
    videoMetadataReady,
    voiceMetadataReady,
    voiceOverAudioUrl,
    videoBufferPct,
    audioBufferPct,
  ]);
  const isSyncingVoice = syncUi.kind === 'working';
  const isBalancedSyncRunning = Boolean(balancedSyncProgress && balancedSyncProgress.percent < 100);
  const isSubtitlesRunning = Boolean(subtitlesProgress && subtitlesProgress.percent < 100);
  const isAnyTaskRunning =
    Boolean(transcribeProgress && transcribeProgress.percent < 100) ||
    isTranscribing ||
    isTranslating ||
    Boolean(voiceOverProgress && voiceOverProgress.percent < 100) ||
    isGenerating ||
    isSyncingVoice ||
    isBalancedSyncRunning ||
    isSubtitlesRunning ||
    exporting;

  return (
    <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <header className="flex items-center justify-between border-b border-card-border bg-subtle/30 px-3 py-2.5">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Subtitles className="h-4 w-4 text-[#b9a4ff]" aria-hidden />
          AI Video Editor
        </div>
        <div className="flex items-center gap-2">
          {typeof onDiscardWorkspace === 'function' ? (
            <button
              type="button"
              onClick={onDiscardWorkspace}
              disabled={isAnyTaskRunning}
              className="h-8 rounded-md border border-red-500/30 bg-transparent px-3 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/10"
            >
              {tEditor('buttons.discardWorkspace')}
            </button>
          ) : null}
          <ActionButton
            onClick={() => void handleFinalExportClick()}
            isLoading={exporting}
            disabled={!workspaceS3Key || exporting || isAnyTaskRunning}
            label={tEditor('buttons.finalExport')}
            loadingLabel={tEditor('buttons.exporting')}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      </header>

      {viralUnifiedJobBar ? (
        <div
          className="border-b border-card-border bg-subtle/35 px-3 py-2.5 lg:px-4"
          role="status"
          aria-live="polite"
          aria-label={`${viralUnifiedJobBar.title}: ${viralUnifiedJobBar.label}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {viralUnifiedJobBar.title}
            </p>
            <p
              className={`text-[11px] font-semibold tabular-nums ${
                viralUnifiedJobBar.done ? 'text-emerald-400' : 'text-muted-foreground'
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
            fillClassName={viralUnifiedJobBar.barClass}
            completeFillClassName={viralUnifiedJobBar.barClass}
            indeterminate={viralUnifiedJobBar.percent < 0}
            indeterminateFillClassName={`w-[40%] max-w-[12rem] animate-pulse ${viralUnifiedJobBar.barClass}`}
          />
        </div>
      ) : null}

      <div className="grid min-h-[640px] grid-cols-1 auto-rows-auto lg:grid-cols-[minmax(300px,420px)_1fr] lg:grid-rows-[auto_1fr] 2xl:grid-cols-[minmax(272px,360px)_minmax(0,1fr)_minmax(296px,400px)] 2xl:grid-rows-1">
        <aside className="flex min-h-0 flex-col border-b border-card-border bg-subtle/20 p-3 lg:col-start-1 lg:row-start-1 lg:border-b-0 lg:border-r lg:p-4 2xl:max-h-[min(100vh-12rem,900px)] 2xl:overflow-y-auto">
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
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-200">
                {transcribeError}
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-md border border-card-border bg-card p-2">
            <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold uppercase text-muted">
              <button
                type="button"
                onClick={() => setLeftTab('script')}
                disabled={isAnyTaskRunning}
                className={`rounded px-2 py-1 text-center transition-colors ${
                  leftTab === 'script' ? 'bg-subtle text-foreground' : 'bg-subtle/60 text-muted hover:bg-subtle'
                }`}
              >
                {tEditor('buttons.scriptTab')}
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('srt')}
                disabled={isAnyTaskRunning}
                className={`rounded px-2 py-1 text-center transition-colors ${
                  leftTab === 'srt' ? 'bg-subtle text-foreground' : 'bg-subtle/60 text-muted hover:bg-subtle'
                }`}
              >
                {tEditor('buttons.srtEditorTab')}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {leftTab === 'script' && transcriptRows.length > 0 ? (
                <div className="rounded border border-card-border bg-subtle/20 px-2 py-1.5 text-[10px] text-muted">
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
                  className="min-h-[220px] w-full resize-y rounded border border-card-border bg-subtle/30 px-2 py-2 text-[11px] leading-snug text-foreground outline-none focus:border-foreground"
                />
              ) : (
                <>
                  <div className="space-y-2 rounded border border-card-border bg-subtle/20 p-2 text-[10px] text-muted">
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
                          <div className="inline-flex items-center overflow-hidden rounded border border-card-border bg-card">
                            <button
                              type="button"
                              className="h-7 w-7 border-r border-card-border text-[13px] font-semibold text-foreground hover:bg-surface disabled:opacity-50"
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
                              className="h-7 w-7 border-l border-card-border text-[13px] font-semibold text-foreground hover:bg-surface disabled:opacity-50"
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
                            className="h-7 rounded border border-card-border bg-card px-1.5 text-[10px] font-semibold text-foreground outline-none hover:bg-surface"
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
                  <div className="flex min-h-0 max-h-[min(420px,48vh)] flex-col gap-2">
                    <div className="min-h-0 flex-1 overflow-auto rounded border border-card-border bg-subtle/10 p-1.5">
                      {editableCues.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted">{tEditor('labels.generateSubtitlesFirst')}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {editableCues.slice(0, 80).map((c) => (
                            <div key={c.id} className="rounded-md border border-card-border bg-card px-2 py-1.5">
                              <div className="flex flex-wrap items-start gap-2">
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
                                    className="mt-0.5 h-7 w-full rounded border border-card-border bg-subtle/20 px-1.5 font-mono text-[10px] text-foreground outline-none focus:border-foreground"
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
                                    className="mt-0.5 h-7 w-full rounded border border-card-border bg-subtle/20 px-1.5 font-mono text-[10px] text-foreground outline-none focus:border-foreground"
                                  />
                                </label>
                                <div className="ml-auto flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    className="h-7 rounded border border-card-border bg-card px-2 text-[10px] font-semibold text-foreground hover:bg-surface"
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
                              <div className="mt-2 rounded-lg border-2 border-dashed border-[#7c5cff]/40 bg-subtle/15 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
                                  className="box-border min-h-[5.5rem] w-full resize-y rounded-md border border-card-border bg-card px-2.5 py-2 text-[12px] leading-relaxed text-foreground outline-none ring-0 transition-shadow focus:border-[#7c5cff]/70 focus:shadow-[0_0_0_1px_rgba(124,92,255,0.35)]"
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
                      <div className="shrink-0 rounded border border-card-border bg-card/80 px-2 py-1.5">
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
                  <details className="rounded border border-card-border bg-subtle/10 p-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-muted">Advanced: edit raw .srt</summary>
                    <textarea
                      value={subtitlesSrtText}
                      disabled={isAnyTaskRunning}
                      onChange={(e) => setSubtitlesSrtText(e.target.value)}
                      placeholder="Raw .srt text…"
                      className="mt-2 min-h-[160px] w-full resize-y rounded border border-card-border bg-subtle/20 p-2 text-[11px] leading-snug text-foreground outline-none focus:border-foreground"
                    />
                  </details>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col border-b border-card-border bg-background/20 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:border-b-0 2xl:col-start-2 2xl:row-span-1 2xl:border-r 2xl:border-card-border">

          <div className="flex items-center justify-between border-b border-card-border px-3 py-2 text-[11px] text-muted">
            <span>Editing Mode</span>
            <span>{isGenerated ? `Voiceover ready: ${voiceLabel}` : 'No Project Loaded'}</span>
          </div>
          <div
            ref={previewSlotRef}
            className="flex min-h-[420px] w-full items-center justify-center border-b border-card-border bg-subtle/20 px-5 py-4"
          >
            <div
              className="relative shrink-0 overflow-hidden rounded-lg border border-card-border bg-black"
              style={{
                width: Math.round(previewFramePx.w),
                height: Math.round(previewFramePx.h),
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
                }}
              />
              {showSubtitlesOverlay && activeSubtitleText.trim() ? (
                <div
                  className="absolute"
                  style={{
                    left: `${Math.round(subtitlesPosition.x * 1000) / 10}%`,
                    top: `${Math.round(subtitlesPosition.y * 1000) / 10}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: subtitlesEditPosition ? 'auto' : 'none',
                  }}
                  onPointerDown={(e) => {
                    if (!subtitlesEditPosition) return;
                    const el = e.currentTarget.parentElement;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
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
                  {subtitlesEditPosition ? (
                    <div className="mt-1 text-center text-[10px] font-semibold text-white/80">Drag to move</div>
                  ) : null}
                </div>
              ) : null}
              {isBalancedPreviewMode ? (
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white">
                  <span className="font-semibold">Balanced preview ready</span>
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

          {voiceOverAudioUrl && !isBalancedPreviewMode ? (
            <div className="border-b border-card-border px-3 py-3 text-[11px] text-muted">
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
            </div>
          ) : null}

          <div className="border-b border-card-border px-3 py-3 text-[11px] text-muted">
            Edit the script in the left column (Script / SRT).
          </div>

          <div className="px-3 py-2.5">
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
            {exportedVideoUrl ? (
              <div className="mb-2 rounded border border-card-border bg-subtle/20 px-2 py-1.5 text-[10px] text-muted">
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

        <aside className="flex min-h-0 flex-col border-t border-card-border bg-subtle/20 p-3 lg:col-start-1 lg:row-start-2 lg:border-t lg:border-r lg:p-4 2xl:col-start-3 2xl:row-start-1 2xl:max-h-[min(100vh-12rem,900px)] 2xl:overflow-y-auto 2xl:border-t-0 2xl:border-l 2xl:border-card-border">
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-card-border bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {tViral('translateSectionTitle')}
              </p>
              <div className="mt-3 flex flex-row items-stretch gap-3">
                <div className="min-w-0 flex-1 basis-0">
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as TranslateTone)}
                    className="viral-translate-tone-select box-border block h-10 w-full min-w-0 rounded-lg border border-card-border bg-card px-3 pr-9 text-sm text-foreground outline-none focus:border-foreground"
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

            <div className="space-y-4 rounded-xl border border-card-border bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{tViral('sectionTitle')}</p>

              <div className="flex items-stretch gap-3 rounded-lg border border-card-border bg-card/40 px-3 py-2.5">
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
                  className="shrink-0 self-center rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
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

              <div className="space-y-3 border-t border-card-border/80 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSyncVoiceToVideo()}
                  disabled={
                    isAnyTaskRunning ||
                    isSyncingVoice || !videoMetadataReady || (Boolean(voiceOverAudioUrl) && !voiceMetadataReady)
                  }
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface disabled:opacity-50"
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
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface disabled:opacity-50"
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
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface"
                >
                  {tEditor('buttons.protectionFlipHue')}
                </button>
                {syncUi.kind !== 'idle' ? (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                      syncUi.kind === 'error'
                        ? 'border-red-500/30 bg-red-500/10 text-red-200'
                        : syncUi.kind === 'warn'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                          : 'border-card-border bg-subtle/20 text-muted'
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
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface disabled:opacity-50"
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
                      onClick={() => window.open(subtitlesDownloadUrl, '_blank', 'noopener,noreferrer')}
                    >
                      {tEditor('buttons.downloadSrt')}
                    </button>
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface"
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
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-400">
                This will use{' '}
                <span className="font-semibold text-foreground">{estimate?.reserveCostPoints ?? '—'}</span> points to
                generate a transcript for your viral workspace.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-400">
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
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-400">
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
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-400">
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
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  onClick={() => setShowExportConfirm(false)}
                >
                  {tEditor('buttons.cancel')}
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  disabled={exportEstimateLoading || exporting || isAnyTaskRunning}
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
                <p className="mt-1 text-xs text-zinc-600 dark:text-slate-400">{tViral('voiceStyleModalSubtitle')}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 px-4 py-4 dark:bg-[#0b1424]">
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
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-400">
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
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-400">
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
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
                    Listen carefully — accept only if it feels aligned.
                  </p>
                </div>
                <button
                  type="button"
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  onClick={() => void handleRejectBalancedSync()}
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
                  className="h-9 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
