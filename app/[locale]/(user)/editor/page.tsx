'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MediaUpload } from '@/components/editor/MediaUpload';
import { VideoCanvas } from '@/components/editor/VideoCanvas';
import { Timeline } from '@/components/editor/Timeline';
import { AudioProperties } from '@/components/editor/panels/AudioProperties';
import { BlurProperties } from '@/components/editor/panels/BlurProperties';
import { CropProperties } from '@/components/editor/panels/CropProperties';
import { SpeedProperties } from '@/components/editor/panels/SpeedProperties';
import { TextProperties } from '@/components/editor/panels/TextProperties';
import { ImageGalleryPanel } from '@/components/editor/panels/ImageGalleryPanel';
import { ImageProperties } from '@/components/editor/panels/ImageProperties';
import { SegmentAudioPanel } from '@/components/editor/panels/SegmentAudioPanel';
import { TrimProperties } from '@/components/editor/panels/TrimProperties';
import { useAudioExtractor } from '@/hooks/useAudioExtractor';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { buildExportPayload, resolveExportVideoUrl } from '@/lib/buildExportPayload';
import { useEditorStore } from '@/store/editorStore';

export default function EditorPage() {
  useAudioExtractor();
  useAudioPlayback();
  useKeyboardShortcuts();

  const setVideoSrc = useEditorStore((s) => s.setVideoSrc);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const textLayers = useEditorStore((s) => s.textLayers);
  const blurLayers = useEditorStore((s) => s.blurLayers);
  const imageLayers = useEditorStore((s) => s.imageLayers);
  const videoSrc = useEditorStore((s) => s.videoSrc);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);

  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);

  useEffect(() => {
    return () => {
      const { galleryImages } = useEditorStore.getState();
      for (const g of galleryImages) {
        if (g.src.startsWith('blob:')) {
          URL.revokeObjectURL(g.src);
        }
      }
      setVideoSrc(null);
    };
  }, [setVideoSrc]);

  const selectedIsText = useMemo(
    () =>
      selectedLayerId != null && textLayers.some((l) => l.id === selectedLayerId),
    [selectedLayerId, textLayers],
  );

  const selectedIsBlur = useMemo(
    () =>
      selectedLayerId != null && blurLayers.some((l) => l.id === selectedLayerId),
    [blurLayers, selectedLayerId],
  );

  const selectedIsImage = useMemo(
    () =>
      selectedLayerId != null && imageLayers.some((l) => l.id === selectedLayerId),
    [imageLayers, selectedLayerId],
  );

  const showPropertiesPanel =
    activeTool === 'text' ||
    activeTool === 'blur' ||
    activeTool === 'image' ||
    activeTool === 'crop' ||
    activeTool === 'speed' ||
    activeTool === 'audio' ||
    activeTool === 'trim' ||
    selectedIsText ||
    selectedIsBlur ||
    selectedIsImage ||
    selectedSegmentId != null;

  const panelTitle = useMemo(() => {
    if (activeTool === 'crop') return 'Crop';
    if (activeTool === 'speed') return 'Speed';
    if (activeTool === 'audio') return 'Audio';
    if (activeTool === 'trim') return 'Trim';
    if (activeTool === 'blur' || selectedIsBlur) return 'Blur';
    if (activeTool === 'image' || selectedIsImage) return 'Image';
    return 'Text';
  }, [activeTool, selectedIsBlur, selectedIsImage]);

  const onExportVideo = useCallback(() => {
    const payload = buildExportPayload(useEditorStore.getState());
    // API integration: send `payload` to your export endpoint.
    console.info('[editor] export payload', payload);
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[480px] flex-col bg-[#0e0e0e] text-zinc-200">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-[#121212] px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">Untitled project</h1>
        <button
          type="button"
          disabled={resolveExportVideoUrl(videoSrc) == null}
          onClick={onExportVideo}
          className="rounded-lg bg-[#534AB7] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4539a0] disabled:pointer-events-none disabled:opacity-40"
        >
          Export video
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-row">
        <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r border-zinc-800 bg-[#121212] p-3">
          <button
            type="button"
            onClick={() => setUploadPanelOpen((open) => !open)}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-left text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
          >
            {uploadPanelOpen ? 'Hide media upload' : 'Media upload'}
          </button>
          {uploadPanelOpen && (
            <div className="mt-3 min-h-0 overflow-y-auto">
              <MediaUpload />
            </div>
          )}

          <button
            type="button"
            onClick={() => setActiveTool('text')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'text'
                ? 'bg-[#1a2a22] text-[#5DCAA5] ring-1 ring-[#1D9E75]'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('blur')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'blur'
                ? 'bg-[#2a1a1a] text-[#F0997B] ring-1 ring-[#993C1D]'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Blur
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('image')}
            className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'image'
                ? 'bg-[#1a1a10] text-[#FAC775] ring-1 ring-[#854F0B]'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="shrink-0 opacity-90"
              aria-hidden
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="8.5" cy="10" r="1.25" fill="currentColor" />
              <path
                d="M4 18.5 L9.5 12.5 L13.5 16.5 L20 9.5 V18.5 H4 Z"
                fill="currentColor"
                opacity="0.45"
              />
            </svg>
            image
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('crop')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'crop'
                ? 'bg-[#1e1033] text-[#c4b5fd] ring-1 ring-[#534AB7]'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Crop
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('speed')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'speed'
                ? 'bg-[#1e1033] text-[#c4b5fd] ring-1 ring-[#534AB7]'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Speed
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('trim')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'trim'
                ? 'bg-[#2a2418] text-[#EF9F27] ring-1 ring-[#EF9F27]/70'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Trim
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('audio')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'audio'
                ? 'bg-[#0a1618] text-[#5DCAA5] ring-1 ring-[#1D9E75]'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Audio
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('pointer')}
            className={`mt-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              activeTool === 'pointer'
                ? 'bg-zinc-700 text-zinc-100 ring-1 ring-zinc-500'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Pointer
          </button>

          {activeTool === 'image' && (
            <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-800 pt-3">
              <ImageGalleryPanel />
            </div>
          )}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <VideoCanvas />
          </div>
        </main>

        {showPropertiesPanel && (
          <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-[#121212]">
            <div className="border-b border-zinc-800 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {panelTitle}
              </h2>
            </div>
            {activeTool === 'crop' ? (
              <CropProperties />
            ) : activeTool === 'speed' ? (
              <SpeedProperties />
            ) : activeTool === 'audio' ? (
              <AudioProperties />
            ) : activeTool === 'trim' ? (
              <TrimProperties />
            ) : activeTool === 'blur' || selectedIsBlur ? (
              <BlurProperties />
            ) : activeTool === 'image' || selectedIsImage ? (
              selectedIsImage ? (
                <ImageProperties />
              ) : (
                <p className="p-3 text-xs leading-relaxed text-zinc-500">
                  Drag a gallery thumbnail onto the preview, or use + on a card to add to the canvas.
                </p>
              )
            ) : (
              <TextProperties />
            )}
            {selectedSegmentId != null && <SegmentAudioPanel />}
          </aside>
        )}
      </div>

      <Timeline />
    </div>
  );
}
