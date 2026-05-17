import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { SrtCue } from '@/features/video-edit/lib/parse-srt';
import { createTextLayersFromSrtCues } from '@/lib/import-srt-cues-as-text-layers';
import type { BlurLayer, TextLayer } from '@/store/editorStore';

const MIN_CLIP_SEC = 1;
const DEFAULT_TEXT_SPAN_SEC = 10;

export type ViralActiveTool = 'pointer' | 'text' | 'blur';

/** A single entry in the unified layer ordering list. */
export type LayerOrderEntry = { id: string; type: 'text' | 'blur' };

function clampSpanToDuration(
  startTime: number,
  endTime: number,
  duration: number,
): { startTime: number; endTime: number } {
  const d = Math.max(0, duration);
  if (d <= 0) return { startTime: 0, endTime: 0 };
  let s = Math.min(Math.max(0, startTime), d);
  let e = Math.min(Math.max(s + MIN_CLIP_SEC, endTime), d);
  if (e - s < MIN_CLIP_SEC) {
    e = Math.min(d, s + MIN_CLIP_SEC);
    s = Math.max(0, e - MIN_CLIP_SEC);
  }
  return { startTime: s, endTime: e };
}

function clampAllLayers(textLayers: TextLayer[], blurLayers: BlurLayer[], duration: number) {
  const d = Math.max(0, duration);
  const text = textLayers.map((l) => {
    const { startTime, endTime } = clampSpanToDuration(l.startTime, l.endTime, d);
    return { ...l, startTime, endTime };
  });
  const blur = blurLayers.map((l) => {
    const { startTime, endTime } = clampSpanToDuration(l.startTime, l.endTime, d);
    return { ...l, startTime, endTime };
  });
  return { textLayers: text, blurLayers: blur };
}

/** Rebuild layerOrder from textLayers + blurLayers, preserving existing entries, adding new ones at top. */
function syncLayerOrder(
  existing: LayerOrderEntry[],
  textLayers: TextLayer[],
  blurLayers: BlurLayer[],
): LayerOrderEntry[] {
  const existingIds = new Set(existing.map((e) => e.id));
  const allIds = new Set([...textLayers.map((l) => l.id), ...blurLayers.map((l) => l.id)]);
  // Remove deleted entries
  const pruned = existing.filter((e) => allIds.has(e.id));
  // Add new entries at the top (end of array = highest z)
  const newEntries: LayerOrderEntry[] = [];
  for (const l of textLayers) {
    if (!existingIds.has(l.id)) newEntries.push({ id: l.id, type: 'text' });
  }
  for (const l of blurLayers) {
    if (!existingIds.has(l.id)) newEntries.push({ id: l.id, type: 'blur' });
  }
  return [...pruned, ...newEntries];
}

export type ViralOverlayState = {
  textLayers: TextLayer[];
  blurLayers: BlurLayer[];
  /**
   * Unified ordered list of all layers.
   * Index 0 = bottom-most, last index = top-most (rendered on top in preview, topmost row in timeline).
   */
  layerOrder: LayerOrderEntry[];
  selectedLayerId: string | null;
  activeTool: ViralActiveTool;
  /** Max duration of the current preview video (seconds). */
  previewDuration: number;
  setPreviewDuration: (sec: number) => void;
  setSelectedLayerId: (id: string | null) => void;
  setActiveTool: (tool: ViralActiveTool) => void;
  addTextLayerAtPlayhead: (playheadSec: number) => void;
  addBlurLayerAtPlayhead: (playheadSec: number) => void;
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void;
  updateBlurLayer: (id: string, patch: Partial<BlurLayer>) => void;
  deleteTextLayer: (id: string) => void;
  deleteBlurLayer: (id: string) => void;
  deleteSelectedLayer: () => void;
  /** Append cues as text layers (same as video editor .srt upload). */
  importSrtCuesAsTextLayers: (cues: SrtCue[], canvasWidth: number, canvasHeight: number) => void;
  /** Replace prior imported-caption layers with a new batch (e.g. after AI subtitle generation). */
  replaceSrtImportFromCues: (cues: SrtCue[], canvasWidth: number, canvasHeight: number) => void;
  addSrtCueLayerAfter: (afterLayerId: string) => void;
  /** Move a layer one step toward the top (higher z-order). */
  moveLayerUp: (id: string) => void;
  /** Move a layer one step toward the bottom (lower z-order). */
  moveLayerDown: (id: string) => void;
  reset: () => void;
  hydrate: (payload: { textLayers?: TextLayer[] | null; blurLayers?: BlurLayer[] | null }) => void;
};

const initial = (): Pick<
  ViralOverlayState,
  'textLayers' | 'blurLayers' | 'layerOrder' | 'selectedLayerId' | 'activeTool' | 'previewDuration'
> => ({
  textLayers: [],
  blurLayers: [],
  layerOrder: [],
  selectedLayerId: null,
  activeTool: 'pointer',
  previewDuration: 0,
});

export const useViralOverlayStore = create<ViralOverlayState>((set, get) => ({
  ...initial(),

  setPreviewDuration: (sec) => {
    const d = Number.isFinite(sec) && sec > 0 ? sec : 0;
    set((s) => {
      const clamped = clampAllLayers(s.textLayers, s.blurLayers, d);
      return {
        previewDuration: d,
        textLayers: clamped.textLayers,
        blurLayers: clamped.blurLayers,
      };
    });
  },

  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  addTextLayerAtPlayhead: (playheadSec) => {
    const state = get();
    const d = state.previewDuration;
    if (d <= 0) return;
    const t = Math.min(Math.max(0, playheadSec), d);
    let startTime = t;
    let endTime = Math.min(d, startTime + DEFAULT_TEXT_SPAN_SEC);
    if (endTime - startTime < MIN_CLIP_SEC) {
      endTime = Math.min(d, startTime + MIN_CLIP_SEC);
    }
    if (endTime - startTime < MIN_CLIP_SEC) {
      startTime = Math.max(0, d - MIN_CLIP_SEC);
      endTime = d;
    }
    const id = nanoid();
    const layer: TextLayer = {
      id,
      type: 'text',
      content: 'New text',
      x: 100,
      y: 100,
      width: 220,
      height: 72,
      fontSize: 24,
      fontFamily: 'Pyidaungsu',
      color: '#ffffff',
      opacity: 100,
      startTime,
      endTime,
    };
    const newOrder: LayerOrderEntry = { id, type: 'text' };
    set({
      textLayers: [...state.textLayers, layer],
      layerOrder: [...state.layerOrder, newOrder], // new = top
      selectedLayerId: id,
      activeTool: 'text',
    });
  },

  addBlurLayerAtPlayhead: (playheadSec) => {
    const state = get();
    const d = state.previewDuration;
    if (d <= 0) return;
    const t = Math.min(Math.max(0, playheadSec), d);
    let startTime = t;
    let endTime = d;
    const span = clampSpanToDuration(startTime, endTime, d);
    startTime = span.startTime;
    endTime = span.endTime;
    const id = nanoid();
    const layer: BlurLayer = {
      id,
      type: 'blur',
      x: 80,
      y: 80,
      width: 160,
      height: 140,
      intensity: 20,
      opacity: 100,
      startTime,
      endTime,
    };
    const newOrder: LayerOrderEntry = { id, type: 'blur' };
    set({
      blurLayers: [...state.blurLayers, layer],
      layerOrder: [...state.layerOrder, newOrder], // new = top
      selectedLayerId: id,
      activeTool: 'blur',
    });
  },

  updateTextLayer: (id, patch) =>
    set((s) => {
      const target = s.textLayers.find((l) => l.id === id);
      const batchId = target?.srtImportBatchId;
      const bulkKeys: (keyof TextLayer)[] = [
        'x',
        'y',
        'width',
        'height',
        'fontSize',
        'fontFamily',
        'color',
        'opacity',
        'backgroundColor',
        'backgroundOpacity',
      ];
      const patchBulk: Partial<TextLayer> = {};
      for (const k of bulkKeys) {
        if (k in patch && patch[k] !== undefined) {
          (patchBulk as Record<string, unknown>)[k] = patch[k] as unknown;
        }
      }
      const propagateBulk = Boolean(batchId) && Object.keys(patchBulk).length > 0;

      return {
        textLayers: s.textLayers.map((l) => {
          if (l.id === id) return { ...l, ...patch };
          if (propagateBulk && l.srtImportBatchId === batchId) return { ...l, ...patchBulk };
          return l;
        }),
      };
    }),

  importSrtCuesAsTextLayers: (cues, canvasWidth, canvasHeight) => {
    const state = get();
    if (cues.length === 0) return;
    const d = state.previewDuration;
    const newLayers = createTextLayersFromSrtCues(cues, {
      duration: d,
      canvasWidth,
      canvasHeight,
    });
    if (newLayers.length === 0) return;
    const lastId = newLayers[newLayers.length - 1]!.id;
    const newOrder: LayerOrderEntry[] = newLayers.map((l) => ({ id: l.id, type: 'text' as const }));
    set({
      textLayers: [...state.textLayers, ...newLayers],
      layerOrder: [...state.layerOrder, ...newOrder],
      selectedLayerId: lastId,
      activeTool: 'text',
    });
  },

  addSrtCueLayerAfter: (afterLayerId) => {
    const state = get();
    const ref = state.textLayers.find((l) => l.id === afterLayerId && l.srtImportBatchId);
    if (!ref) return;
    const d = state.previewDuration;
    let startTime = Math.max(0, ref.endTime);
    let endTime = Math.min(d > 0 ? d : startTime + 1.6, startTime + 1.6);
    if (d > 0 && endTime - startTime < MIN_CLIP_SEC) {
      endTime = Math.min(d, startTime + MIN_CLIP_SEC);
    }
    const id = nanoid();
    const layer: TextLayer = {
      id,
      type: 'text',
      content: '',
      x: ref.x,
      y: ref.y,
      width: ref.width,
      height: ref.height,
      fontSize: ref.fontSize,
      fontFamily: ref.fontFamily,
      color: ref.color,
      opacity: ref.opacity,
      backgroundColor: ref.backgroundColor,
      backgroundOpacity: ref.backgroundOpacity,
      startTime,
      endTime,
      srtImportBatchId: ref.srtImportBatchId,
    };
    const newOrder: LayerOrderEntry = { id, type: 'text' };
    set({
      textLayers: [...state.textLayers, layer],
      layerOrder: [...state.layerOrder, newOrder],
      selectedLayerId: id,
      activeTool: 'text',
    });
  },

  replaceSrtImportFromCues: (cues, canvasWidth, canvasHeight) => {
    const state = get();
    const keptText = state.textLayers.filter((l) => !l.srtImportBatchId);
    const keptOrder = state.layerOrder.filter((e) => {
      if (e.type !== 'text') return true;
      return keptText.some((l) => l.id === e.id);
    });
    if (cues.length === 0) {
      set({
        textLayers: keptText,
        layerOrder: keptOrder,
        selectedLayerId: null,
      });
      return;
    }
    const d = state.previewDuration;
    const newLayers = createTextLayersFromSrtCues(cues, {
      duration: d,
      canvasWidth,
      canvasHeight,
    });
    const lastId = newLayers[newLayers.length - 1]!.id;
    const newOrder: LayerOrderEntry[] = newLayers.map((l) => ({ id: l.id, type: 'text' as const }));
    set({
      textLayers: [...keptText, ...newLayers],
      layerOrder: [...keptOrder, ...newOrder],
      selectedLayerId: lastId,
      activeTool: 'text',
    });
  },

  updateBlurLayer: (id, patch) =>
    set((s) => ({
      blurLayers: s.blurLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),

  deleteTextLayer: (id) =>
    set((s) => ({
      textLayers: s.textLayers.filter((l) => l.id !== id),
      layerOrder: s.layerOrder.filter((e) => e.id !== id),
      selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
    })),

  deleteBlurLayer: (id) =>
    set((s) => ({
      blurLayers: s.blurLayers.filter((l) => l.id !== id),
      layerOrder: s.layerOrder.filter((e) => e.id !== id),
      selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
    })),

  deleteSelectedLayer: () => {
    const s = get();
    const id = s.selectedLayerId;
    if (!id) return;
    if (s.textLayers.some((l) => l.id === id)) {
      set({
        textLayers: s.textLayers.filter((l) => l.id !== id),
        layerOrder: s.layerOrder.filter((e) => e.id !== id),
        selectedLayerId: null,
      });
    } else if (s.blurLayers.some((l) => l.id === id)) {
      set({
        blurLayers: s.blurLayers.filter((l) => l.id !== id),
        layerOrder: s.layerOrder.filter((e) => e.id !== id),
        selectedLayerId: null,
      });
    }
  },

  moveLayerUp: (id) =>
    set((s) => {
      const idx = s.layerOrder.findIndex((e) => e.id === id);
      if (idx < 0 || idx === s.layerOrder.length - 1) return {}; // already top
      const next = [...s.layerOrder];
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      return { layerOrder: next };
    }),

  moveLayerDown: (id) =>
    set((s) => {
      const idx = s.layerOrder.findIndex((e) => e.id === id);
      if (idx <= 0) return {}; // already bottom
      const next = [...s.layerOrder];
      [next[idx], next[idx - 1]] = [next[idx - 1]!, next[idx]!];
      return { layerOrder: next };
    }),

  reset: () => set(initial()),

  hydrate: (payload) => {
    const textRaw = payload.textLayers;
    const blurRaw = payload.blurLayers;
    const textLayers = Array.isArray(textRaw)
      ? textRaw.filter((l): l is TextLayer => l && typeof l === 'object' && l.type === 'text')
      : [];
    const blurLayers = Array.isArray(blurRaw)
      ? blurRaw.filter((l): l is BlurLayer => l && typeof l === 'object' && l.type === 'blur')
      : [];
    const d = get().previewDuration;
    const clamped = clampAllLayers(textLayers, blurLayers, d);
    const layerOrder = syncLayerOrder(get().layerOrder, clamped.textLayers, clamped.blurLayers);
    set({
      textLayers: clamped.textLayers,
      blurLayers: clamped.blurLayers,
      layerOrder,
      selectedLayerId: null,
    });
  },
}));
