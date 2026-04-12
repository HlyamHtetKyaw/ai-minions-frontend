'use client';

import { useEffect } from 'react';
import { MAIN_VIDEO_TIMELINE_CLIP_ID, useEditorStore } from '@/store/editorStore';

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const deleteTextLayer = useEditorStore((s) => s.deleteTextLayer);
  const deleteBlurLayer = useEditorStore((s) => s.deleteBlurLayer);
  const deleteImageLayer = useEditorStore((s) => s.deleteImageLayer);
  const deleteVideoTimelineSegment = useEditorStore((s) => s.deleteVideoTimelineSegment);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.key === ' ' || e.code === 'Space') {
        if (e.repeat) return;
        const state = useEditorStore.getState();
        if (state.videoSrc == null || state.duration <= 0) return;
        const v = state.videoElement;
        if (!v) return;
        e.preventDefault();
        if (v.paused) {
          void v.play().catch(() => {
            /* ignore play() interruption races */
          });
        } else {
          v.pause();
        }
        return;
      }

      if (e.key === 'Escape') {
        setSelectedLayerId(null);
        setSelectedAudioTrackId(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState();
        const sid = state.selectedLayerId;
        const vts = state.videoTimelineSegments;
        const isVideoSeg =
          sid != null &&
          (vts.some((s) => s.id === sid) ||
            (vts.length === 0 && sid === MAIN_VIDEO_TIMELINE_CLIP_ID));
        if (isVideoSeg && vts.length > 1) {
          e.preventDefault();
          deleteVideoTimelineSegment(sid);
          setSelectedLayerId(null);
          const v = state.videoElement;
          const t = useEditorStore.getState().currentTime;
          if (v) v.currentTime = t;
          return;
        }
        if (sid == null || sid === MAIN_VIDEO_TIMELINE_CLIP_ID) {
          return;
        }
        const isText = state.textLayers.some((l) => l.id === sid);
        const isBlur = state.blurLayers.some((l) => l.id === sid);
        const isImage = state.imageLayers.some((l) => l.id === sid);
        if (!isText && !isBlur && !isImage) return;
        e.preventDefault();
        if (isText) {
          deleteTextLayer(sid);
        } else if (isBlur) {
          deleteBlurLayer(sid);
        } else {
          deleteImageLayer(sid);
        }
        setSelectedLayerId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedLayerId,
    deleteBlurLayer,
    deleteImageLayer,
    deleteTextLayer,
    deleteVideoTimelineSegment,
    setSelectedLayerId,
    setSelectedAudioTrackId,
  ]);
}
