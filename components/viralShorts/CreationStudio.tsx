'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Play, Subtitles } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';
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
import { parseSrt, type SrtCue } from '@/features/video-edit/lib/parse-srt';
import {
  extractTranscriptTextFromOutputData,
  openGenerationJobSseStream,
  parseGenerationSseProgressPayload,
} from '@/lib/generation-job-sse';
import { videoEditorExportEstimateExisting, videoEditorExportWorkspace } from '@/lib/video-editor-api';
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
  onDiscardWorkspace?: () => void;
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
  onDiscardWorkspace,
}: Props) {
  const tVo = useTranslations('voice-over');
  const tViral = useTranslations('viralShorts.voiceStudio');
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
  const autoDownloadRef = useRef<string>('');

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
  const subtitleDragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );
  const [leftTab, setLeftTab] = useState<'script' | 'srt'>(() => (subtitlesSrtText.trim() ? 'srt' : 'script'));
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = useState(true);
  const [activeSubtitleText, setActiveSubtitleText] = useState('');

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
  const [isTranscribed, setIsTranscribed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  // Track buffering progress (used for Sync gating + UX, but should NOT block normal playback).
  useEffect(() => {
    setVideoBufferPct(0);
    setVideoFullyLoaded(false);

    const v = videoRef.current;
    if (!v) return;

    const calc = () => {
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return;
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
      if (videoBufferPct >= 0.995) setVideoFullyLoaded(true);
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
    if (!voiceOverPlayableUrl && !voiceOverAudioUrl) return;

    const a = voiceRef.current;
    if (!a) return;

    const calc = () => {
      const d = a.duration;
      if (!Number.isFinite(d) || d <= 0) return;
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
      if (audioBufferPct >= 0.995) setVoiceFullyLoaded(true);
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
    // Reset derived state when switching videos.
    const restoredTranscript = typeof initialTranscriptText === 'string' ? initialTranscriptText : '';
    const restoredTranslated = typeof initialTranslatedText === 'string' ? initialTranslatedText : '';
    setTranscriptText(restoredTranscript);
    setTranslatedText(restoredTranslated);
    setIsTranscribed(Boolean(restoredTranscript.trim()));
    setIsTranslated(Boolean(restoredTranslated.trim()));
    setIsGenerated(false);
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
    setVoiceOverEnabled(Boolean(initialVoiceOverEnabled));
    setOriginalAudioEnabled(initialOriginalAudioEnabled == null ? true : Boolean(initialOriginalAudioEnabled));
    const r = typeof initialVoiceOverPlaybackRate === 'number' ? initialVoiceOverPlaybackRate : 1;
    {
      const max = Boolean(initialAllowStrongerSync) ? MAX_SYNC_RATE_STRONG : MAX_SYNC_RATE;
      setVoiceOverPlaybackRate(Number.isFinite(r) ? Math.max(MIN_SYNC_RATE, Math.min(max, r)) : 1);
    }
    setAllowStrongerSync(Boolean(initialAllowStrongerSync));
    if (!workspaceS3Key) return;

    setEstimateLoading(true);
    (async () => {
      try {
        const est = await transcribeEstimatePointsFromExisting(workspaceS3Key, 'video');
        setEstimate(est);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setEstimateError(msg);
      } finally {
        setEstimateLoading(false);
      }
    })();
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
    setSubtitlesError(null);
    setSubtitlesProgress({ percent: 10, label: 'Starting subtitles…' });
    try {
      const complete = await subtitlesFromExisting({
        s3Key: workspaceS3Key,
        sourceType: 'video',
        targetLanguage: 'my',
        style: 'caption_rules_v1',
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
            setTranscribeProgress({ percent: 100, label: 'Finished' });
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
    if (isTranscribing || !workspaceS3Key) return;
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
    try {
      if (!workspaceS3Key) throw new Error('Video key is missing. Please re-upload the video.');
      setExportEstimateLoading(true);
      const est = await videoEditorExportEstimateExisting(workspaceS3Key);
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
    setExporting(true);
    try {
      const v = videoRef.current;
      const duration = v?.duration;
      if (!duration || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('Video duration not ready. Play the video once, then try Export again.');
      }
      const baseUrl = String(videoUrl ?? '');
      const noFrag = baseUrl.includes('#') ? baseUrl.slice(0, baseUrl.indexOf('#')) : baseUrl;
      const payload = {
        videoUrl: noFrag,
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
      };
      const res = await videoEditorExportWorkspace(payload);
      setExportedVideoUrl(res.readUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(msg || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!exportedVideoUrl) return;
    if (autoDownloadRef.current === exportedVideoUrl) return;
    autoDownloadRef.current = exportedVideoUrl;
    try {
      // Trigger download in the current tab (no popup blockers).
      // User can press Back to return to the editor.
      window.location.assign(exportedVideoUrl);
    } catch {
      // Fallback: user can still click Download.
    }
  }, [exportedVideoUrl]);

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
              setVoiceOverProgress({ percent: 100, label: tVo('progress.finished') });
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
              className="h-8 rounded-md border border-red-500/30 bg-transparent px-3 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/10"
            >
              Discard workspace
            </button>
          ) : null}
          <ActionButton
            onClick={() => void handleFinalExportClick()}
            isLoading={exporting}
            disabled={!workspaceS3Key || exporting}
            label="Final Export"
            loadingLabel="Exporting..."
            className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      </header>

      <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr]">
        <aside className="border-r border-card-border bg-subtle/20 p-3 lg:p-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTranscribeClick}
              disabled={isTranscribing || !workspaceS3Key}
              className="btn-transcribe"
            >
              {isTranscribing ? 'Transcribing...' : '1. Transcribe Video'}
            </button>
            {transcribeProgress ? (
              <div className="rounded border border-card-border bg-subtle/20 px-2 py-1.5 text-[10px] text-muted">
                {transcribeProgress.label} ({transcribeProgress.percent}%)
              </div>
            ) : null}
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
                className={`rounded px-2 py-1 text-center transition-colors ${
                  leftTab === 'script' ? 'bg-subtle text-foreground' : 'bg-subtle/60 text-muted hover:bg-subtle'
                }`}
              >
                Script
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('srt')}
                className={`rounded px-2 py-1 text-center transition-colors ${
                  leftTab === 'srt' ? 'bg-subtle text-foreground' : 'bg-subtle/60 text-muted hover:bg-subtle'
                }`}
              >
                SRT Editor
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setScriptText(v);
                    if (isTranslated) {
                      setTranslatedText(v);
                    } else {
                      setTranscriptText(v);
                    }
                  }}
                  placeholder="Click Transcribe to generate script."
                  className="min-h-[220px] w-full resize-y rounded border border-card-border bg-subtle/30 px-2 py-2 text-[11px] leading-snug text-foreground outline-none focus:border-foreground"
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 rounded border border-card-border bg-subtle/20 px-2 py-1.5 text-[10px] text-muted">
                    <span>{editableCues.length} cues</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showSubtitlesOverlay}
                          onChange={(e) => setShowSubtitlesOverlay(e.target.checked)}
                        />
                        Show on video
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={subtitlesEditPosition}
                          disabled={!showSubtitlesOverlay}
                          onChange={(e) => setSubtitlesEditPosition(e.target.checked)}
                        />
                        Move
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="whitespace-nowrap">Size</span>
                        <div className="inline-flex items-center overflow-hidden rounded border border-card-border bg-card">
                          <button
                            type="button"
                            className="h-6 w-6 border-r border-card-border text-[12px] font-semibold text-foreground hover:bg-surface disabled:opacity-50"
                            onClick={() => setSubtitlesFontSize((v) => Math.max(14, v - 1))}
                            disabled={subtitlesFontSize <= 14}
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
                            className="h-6 w-10 bg-transparent text-center text-[11px] font-semibold text-foreground outline-none"
                            aria-label="Subtitle size"
                          />
                          <button
                            type="button"
                            className="h-6 w-6 border-l border-card-border text-[12px] font-semibold text-foreground hover:bg-surface disabled:opacity-50"
                            onClick={() => setSubtitlesFontSize((v) => Math.min(60, v + 1))}
                            disabled={subtitlesFontSize >= 60}
                            aria-label="Increase subtitle size"
                          >
                            +
                          </button>
                        </div>
                        <select
                          value={String(subtitlesFontSize)}
                          onChange={(e) => {
                            const n = Math.max(14, Math.min(60, Number(e.target.value) || 22));
                            setSubtitlesFontSize(Number.isFinite(n) ? n : 22);
                          }}
                          className="h-6 rounded border border-card-border bg-card px-1 text-[10px] font-semibold text-foreground outline-none hover:bg-surface"
                          aria-label="Preset subtitle sizes"
                        >
                          {[14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 60].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-auto rounded border border-card-border bg-subtle/10 p-2">
                    {editableCues.length === 0 ? (
                      <p className="text-xs text-muted">Generate subtitles first to populate cues.</p>
                    ) : (
                      <div className="space-y-2">
                        {editableCues.slice(0, 80).map((c) => (
                          <div key={c.id} className="rounded border border-card-border bg-card p-2">
                            <div className="grid grid-cols-[1fr_1fr] gap-2">
                              <label className="text-[10px] text-muted">
                                Start
                                <input
                                  value={formatSrtTimestamp(c.startTime)}
                                  onChange={(e) => {
                                    const next = parseTimeInput(e.target.value);
                                    if (next == null) return;
                                    setEditableCues((prev) =>
                                      prev.map((x) =>
                                        x.id === c.id ? { ...x, startTime: Math.max(0, next) } : x,
                                      ),
                                    );
                                  }}
                                  className="mt-1 h-8 w-full rounded border border-card-border bg-subtle/20 px-2 text-[11px] text-foreground outline-none focus:border-foreground"
                                />
                              </label>
                              <label className="text-[10px] text-muted">
                                End
                                <input
                                  value={formatSrtTimestamp(c.endTime)}
                                  onChange={(e) => {
                                    const next = parseTimeInput(e.target.value);
                                    if (next == null) return;
                                    setEditableCues((prev) =>
                                      prev.map((x) =>
                                        x.id === c.id ? { ...x, endTime: Math.max(next, x.startTime + 0.05) } : x,
                                      ),
                                    );
                                  }}
                                  className="mt-1 h-8 w-full rounded border border-card-border bg-subtle/20 px-2 text-[11px] text-foreground outline-none focus:border-foreground"
                                />
                              </label>
                            </div>
                            <label className="mt-2 block text-[10px] text-muted">
                              Text
                              <textarea
                                value={c.content}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditableCues((prev) => prev.map((x) => (x.id === c.id ? { ...x, content: v } : x)));
                                }}
                                className="mt-1 min-h-[60px] w-full resize-y rounded border border-card-border bg-subtle/20 px-2 py-1.5 text-[11px] leading-snug text-foreground outline-none focus:border-foreground"
                              />
                            </label>
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="h-8 rounded-md border border-card-border bg-card px-2 text-[10px] font-semibold text-foreground transition-colors hover:bg-surface"
                                onClick={() => {
                                  const nextStart = Math.max(0, c.endTime);
                                  const nextEnd = nextStart + 1.6;
                                  const id = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                                  setEditableCues((prev) => {
                                    const idx = prev.findIndex((x) => x.id === c.id);
                                    const nextCue: EditableSrtCue = { id, startTime: nextStart, endTime: nextEnd, content: '' };
                                    if (idx < 0) return [...prev, nextCue];
                                    return [...prev.slice(0, idx + 1), nextCue, ...prev.slice(idx + 1)];
                                  });
                                }}
                              >
                                + Add after
                              </button>
                              <button
                                type="button"
                                className="h-8 rounded-md border border-red-500/30 bg-transparent px-2 text-[10px] font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/10"
                                onClick={() => setEditableCues((prev) => prev.filter((x) => x.id !== c.id))}
                              >
                                Remove
                              </button>
                              <button
                                type="button"
                                className="h-8 rounded-md bg-[#7c5cff] px-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#6b4bff]"
                                onClick={() => {
                                  srtSyncFromTableRef.current = true;
                                  setSubtitlesSrtText(cuesToSrt(editableCues));
                                }}
                              >
                                Save SRT
                              </button>
                            </div>
                          </div>
                        ))}
                        {editableCues.length > 80 ? <p className="text-[10px] text-muted">Showing first 80 cues.</p> : null}
                      </div>
                    )}
                  </div>
                  <details className="rounded border border-card-border bg-subtle/10 p-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-muted">Advanced: edit raw .srt</summary>
                    <textarea
                      value={subtitlesSrtText}
                      onChange={(e) => setSubtitlesSrtText(e.target.value)}
                      placeholder="Raw .srt text…"
                      className="mt-2 min-h-[160px] w-full resize-y rounded border border-card-border bg-subtle/20 p-2 text-[11px] leading-snug text-foreground outline-none focus:border-foreground"
                    />
                  </details>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
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
                  disabled={!isTranscribed || isTranslating}
                  label="Translate"
                  loadingLabel="Translating..."
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
                  disabled={voiceModelsLoading || isGenerating}
                >
                  {tViral('chooseVoiceStyleButton')}
                </button>
              </div>

              <ActionButton
                onClick={() => void handleGenerate()}
                isLoading={isGenerating}
                disabled={!isTranslated || isGenerating}
                label="Generate"
                loadingLabel="Generating..."
                className="btn-viral-shorts h-11 w-full rounded-xl px-4 text-sm font-semibold"
              />

              {voiceOverProgress ? (
                <div
                  className={`rounded-xl border border-card-border bg-card px-3 py-3 ${
                    voiceOverProgress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`text-xs ${
                        voiceOverProgress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {voiceOverProgress.label}
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {voiceOverProgress.percent}%
                    </p>
                  </div>
                  <div
                    className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-subtle"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={voiceOverProgress.percent}
                    aria-label={voiceOverProgress.label}
                  >
                    <div
                      className={`h-2.5 rounded-full transition-[width] duration-300 ease-out ${
                        voiceOverProgress.percent >= 100 ? 'bg-emerald-600' : 'bg-violet-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, voiceOverProgress.percent))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {voiceOverError ? (
                <p className="text-xs leading-relaxed text-red-400">{voiceOverError}</p>
              ) : null}

              <div className="space-y-3 border-t border-card-border/80 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSyncVoiceToVideo()}
                  disabled={!videoFullyLoaded || (Boolean(voiceOverAudioUrl) && !voiceFullyLoaded)}
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  Sync voice length to audio
                </button>
                <button
                  type="button"
                  onClick={() => void handleBalancedSyncClick()}
                  disabled={
                    isBalancedPreviewMode ||
                    !voiceOverAudioUrl ||
                    !voiceOverS3Key ||
                    !videoFullyLoaded ||
                    !voiceFullyLoaded ||
                    Boolean(balancedSyncProgress && balancedSyncProgress.percent < 100) ||
                    balancedSyncEstimateLoading
                  }
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {'Balanced sync (render & combine)'}
                </button>
                {balancedSyncEstimateError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                    {balancedSyncEstimateError}
                  </div>
                ) : null}
                {balancedSyncProgress ? (
                  <div className="rounded-lg border border-card-border bg-subtle/20 px-3 py-2 text-xs text-muted">
                    {balancedSyncProgress.label} ({balancedSyncProgress.percent}%)
                  </div>
                ) : null}
                {balancedSyncError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                    {balancedSyncError}
                  </div>
                ) : null}
                {!videoFullyLoaded || (Boolean(voiceOverAudioUrl) && !voiceFullyLoaded) ? (
                  <div className="rounded-lg border border-card-border bg-subtle/20 px-3 py-2 text-xs leading-relaxed text-muted">
                    Loading media… Video {Math.round(videoBufferPct * 100)}%
                    {voiceOverAudioUrl ? ` · Voice ${Math.round(audioBufferPct * 100)}%` : ''}
                  </div>
                ) : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-0.5 py-1 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={allowStrongerSync}
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
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface"
                >
                  Protection (flip + hue)
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
                  disabled={!workspaceS3Key || Boolean(subtitlesProgress && subtitlesProgress.percent < 100)}
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  Generate subtitles
                </button>
                {subtitlesProgress ? (
                  <div className="rounded-lg border border-card-border bg-subtle/20 px-3 py-2 text-xs text-muted">
                    {subtitlesProgress.label} ({subtitlesProgress.percent}%)
                  </div>
                ) : null}
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
                      onClick={() => window.open(subtitlesDownloadUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Download (.srt)
                    </button>
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center justify-center rounded-lg border border-card-border bg-card px-3 py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface"
                      onClick={() => setLeftTab('srt')}
                    >
                      Open SRT editor
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        {showTranscribeConfirm ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm transcription"
            onMouseDown={() => setShowTranscribeConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-card-border bg-card p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Transcribe this video?</p>
              <p className="mt-2 text-sm text-muted">
                This will use{' '}
                <span className="font-semibold text-foreground">{estimate?.reserveCostPoints ?? '—'}</span> points to
                generate a transcript for your viral workspace.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => setShowTranscribeConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                  disabled={isTranscribing || !workspaceS3Key}
                  onClick={() => {
                    setShowTranscribeConfirm(false);
                    void startTranscribe();
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showTranslateConfirm ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm translation"
            onMouseDown={() => setShowTranslateConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-card-border bg-card p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Translate this transcript?</p>
              <p className="mt-2 text-sm text-muted">
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
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => setShowTranslateConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                  disabled={!isTranscribed || isTranslating || translateEstimateLoading}
                  onClick={() => {
                    setShowTranslateConfirm(false);
                    void handleTranslate();
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSubtitlesConfirm ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm subtitles"
            onMouseDown={() => setShowSubtitlesConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-card-border bg-card p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Generate subtitles?</p>
              <p className="mt-2 text-sm text-muted">
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
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => setShowSubtitlesConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                  disabled={subtitlesEstimateLoading}
                  onClick={() => {
                    setShowSubtitlesConfirm(false);
                    void startSubtitles();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showExportConfirm ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm export"
            onMouseDown={() => setShowExportConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-card-border bg-card p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Export final video?</p>
              <p className="mt-2 text-sm text-muted">
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
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => setShowExportConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  disabled={exportEstimateLoading || exporting}
                  onClick={() => {
                    setShowExportConfirm(false);
                    void startFinalExport();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showVoiceStyleModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-style-modal-title"
            onMouseDown={() => setShowVoiceStyleModal(false)}
          >
            <div
              className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-2xl border border-card-border bg-card shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="border-b border-card-border px-4 py-3">
                <p id="voice-style-modal-title" className="text-sm font-semibold text-foreground">
                  {tViral('voiceStyleModalTitle')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{tViral('voiceStyleModalSubtitle')}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <VoiceToneVoicePicker
                  catalog={voiceModelCatalog}
                  loading={voiceModelsLoading}
                  error={voiceModelsError}
                  toneGroupId={voiceToneGroupId}
                  onToneGroupChange={setVoiceToneGroupId}
                  selectedVoiceId={selectedVoiceId}
                  onVoiceIdChange={setSelectedVoiceId}
                  disabled={isGenerating}
                />
              </div>
              <div className="flex justify-end border-t border-card-border px-4 py-3">
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm voice over"
            onMouseDown={() => setShowVoiceOverConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-card-border bg-card p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Generate voice over?</p>
              <p className="mt-2 text-sm text-muted">
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
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => setShowVoiceOverConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                  disabled={!isTranslated || isGenerating}
                  onClick={() => {
                    setShowVoiceOverConfirm(false);
                    void startVoiceOver();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showBalancedSyncConfirm ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm balanced sync"
            onMouseDown={() => setShowBalancedSyncConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-card-border bg-card p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Render balanced sync?</p>
              <p className="mt-2 text-sm text-muted">
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
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => setShowBalancedSyncConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff] disabled:opacity-50"
                  disabled={balancedSyncEstimateLoading}
                  onClick={() => {
                    setShowBalancedSyncConfirm(false);
                    void handleStartBalancedSync();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showBalancedPreview && isBalancedPreviewMode ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Balanced sync preview"
          >
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-card-border bg-card shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Balanced sync preview</p>
                  <p className="mt-0.5 text-xs text-muted">Listen carefully — accept only if it feels aligned.</p>
                </div>
                <button
                  type="button"
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => void handleRejectBalancedSync()}
                >
                  Close
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
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border px-4 py-3">
                <button
                  type="button"
                  className="h-9 rounded-md border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  onClick={() => void handleRejectBalancedSync()}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md bg-[#7c5cff] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b4bff]"
                  onClick={() => void handleAcceptBalancedSync()}
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col bg-background/20">
          <div className="flex items-center justify-between border-b border-card-border px-3 py-2 text-[11px] text-muted">
            <span>Editing Mode</span>
            <span>{isGenerated ? `Voiceover ready: ${voiceLabel}` : 'No Project Loaded'}</span>
          </div>
          <div className="flex min-h-[420px] items-center justify-center border-b border-card-border bg-subtle/20 px-5 py-4">
            <div className="relative overflow-hidden rounded-lg border border-card-border bg-black">
              <video
                ref={videoRef}
                src={isBalancedPreviewMode ? balancedSyncPreviewUrl : videoUrl}
                controls
                playsInline
                preload="auto"
                className="h-[360px] w-[min(56vw,640px)] object-contain"
                style={{
                  transform: protectFlip ? 'scaleX(-1)' : undefined,
                  filter: protectHueDeg ? `hue-rotate(${protectHueDeg}deg)` : undefined,
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
                  <div className="max-w-[92%] rounded-lg bg-black/65 px-3 py-2 text-center text-sm font-semibold text-white">
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
                    className="h-7 rounded-md bg-[#7c5cff] px-2 font-semibold text-white hover:bg-[#6b4bff]"
                  >
                    Preview & Accept
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
                    disabled={!voiceOverAudioUrl}
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
            Edit the script directly in the left Script panel.
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
                Export ready.{' '}
                <button
                  type="button"
                  className="font-semibold text-foreground underline"
                  onClick={() => window.open(exportedVideoUrl, '_blank', 'noopener,noreferrer')}
                >
                  Download
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
