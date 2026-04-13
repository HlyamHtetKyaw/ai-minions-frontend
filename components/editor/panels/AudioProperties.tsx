'use client';

import { useCallback, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

const AUDIO_ACCEPT =
  'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/x-aac,.mp3,.wav,.aac';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function AudioProperties() {
  const duration = useEditorStore((s) => s.duration);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const originalAudioMuted = useEditorStore((s) => s.originalAudioMuted);
  const originalAudioVolume = useEditorStore((s) => s.originalAudioVolume);
  const selectedAudioTrackId = useEditorStore((s) => s.selectedAudioTrackId);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);
  const deleteAudioTrack = useEditorStore((s) => s.deleteAudioTrack);
  const setOriginalAudioMuted = useEditorStore((s) => s.setOriginalAudioMuted);
  const setOriginalAudioVolume = useEditorStore((s) => s.setOriginalAudioVolume);
  const setSelectedAudioTrackId = useEditorStore((s) => s.setSelectedAudioTrackId);

  const musicInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const selectedTrack =
    selectedAudioTrackId == null
      ? undefined
      : audioTracks.find((t) => t.id === selectedAudioTrackId);

  const onMusicFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) addAudioTrack('music', file);
      e.target.value = '';
    },
    [addAudioTrack],
  );

  const onVoiceFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) addAudioTrack('voiceover', file);
      e.target.value = '';
    },
    [addAudioTrack],
  );

  return (
    <div className="flex flex-col gap-4 p-3">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Upload
        </h3>
        <div className="flex gap-2">
          <input
            ref={musicInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            className="sr-only"
            aria-hidden
            onChange={onMusicFile}
          />
          <input
            ref={voiceInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            className="sr-only"
            aria-hidden
            onChange={onVoiceFile}
          />
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            className="flex-1 rounded-lg bg-[#0a1612] px-2 py-2 text-center text-[11px] font-medium text-[#1D9E75] ring-1 ring-[#1D9E75]/60 transition-colors hover:bg-[#0f2218]"
          >
            Add music
          </button>
          <button
            type="button"
            onClick={() => voiceInputRef.current?.click()}
            className="flex-1 rounded-lg bg-[#0a1a2a] px-2 py-2 text-center text-[11px] font-medium text-[#378ADD] ring-1 ring-[#185FA5]/70 transition-colors hover:bg-[#0f1f33]"
          >
            Add voiceover
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Original audio
        </h3>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setOriginalAudioMuted(!originalAudioMuted)}
            className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              originalAudioMuted
                ? 'bg-red-950/50 text-red-300 ring-1 ring-red-800/80'
                : 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700'
            }`}
          >
            {originalAudioMuted ? 'Unmute' : 'Mute'}
          </button>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Volume
            </span>
            {selectedTrack == null ? (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={originalAudioVolume}
                  onChange={(e) => setOriginalAudioVolume(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-[#534AB7]"
                />
                <span className="w-8 tabular-nums text-right text-xs text-zinc-400">
                  {originalAudioVolume}
                </span>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Original track volume hidden while editing a selected audio layer.
              </p>
            )}
          </label>
        </div>
      </section>

      {selectedTrack != null && (
        <>
          <section>
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs text-zinc-500" title={selectedTrack.name}>
                {selectedTrack.name}
              </p>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                  selectedTrack.type === 'voiceover'
                    ? 'bg-[#0a1a2a] text-[#378ADD]'
                    : 'bg-[#0a1612] text-[#1D9E75]'
                }`}
              >
                {selectedTrack.type === 'voiceover' ? 'voiceover' : 'music'}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Volume
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={selectedTrack.volume}
                onChange={(e) =>
                  updateAudioTrack(selectedTrack.id, { volume: Number(e.target.value) })
                }
                className="min-w-0 flex-1 accent-[#534AB7]"
              />
              <span className="w-8 tabular-nums text-right text-xs text-zinc-400">
                {selectedTrack.volume}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Fade in
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={selectedTrack.fadeIn}
                onChange={(e) =>
                  updateAudioTrack(selectedTrack.id, { fadeIn: Number(e.target.value) })
                }
                className="min-w-0 flex-1 accent-[#534AB7]"
              />
              <span className="w-10 tabular-nums text-right text-xs text-zinc-400">
                {selectedTrack.fadeIn}s
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Fade out
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={selectedTrack.fadeOut}
                onChange={(e) =>
                  updateAudioTrack(selectedTrack.id, { fadeOut: Number(e.target.value) })
                }
                className="min-w-0 flex-1 accent-[#534AB7]"
              />
              <span className="w-10 tabular-nums text-right text-xs text-zinc-400">
                {selectedTrack.fadeOut}s
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Timing
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">Start (s)</span>
                <input
                  type="number"
                  min={0}
                  max={duration > 0 ? duration : undefined}
                  step={0.1}
                  value={Number.isFinite(selectedTrack.startTime) ? selectedTrack.startTime : 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const d = duration > 0 ? duration : 1e9;
                    updateAudioTrack(selectedTrack.id, {
                      startTime: clamp(v, 0, d),
                    });
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-100 outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">End (s)</span>
                <input
                  type="number"
                  min={0}
                  max={duration > 0 ? duration : undefined}
                  step={0.1}
                  value={Number.isFinite(selectedTrack.endTime) ? selectedTrack.endTime : 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const d = duration > 0 ? duration : 1e9;
                    updateAudioTrack(selectedTrack.id, {
                      endTime: clamp(v, 0, d),
                    });
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-100 outline-none"
                />
              </label>
            </div>
          </section>

          <section className="flex items-center gap-2">
            <input
              id="mute-track"
              type="checkbox"
              checked={selectedTrack.isMuted}
              onChange={(e) =>
                updateAudioTrack(selectedTrack.id, { isMuted: e.target.checked })
              }
              className="rounded border-zinc-600"
            />
            <label htmlFor="mute-track" className="text-xs text-zinc-300">
              Mute this track
            </label>
          </section>

          <button
            type="button"
            onClick={() => {
              deleteAudioTrack(selectedTrack.id);
              setSelectedAudioTrackId(null);
            }}
            className="rounded-lg bg-red-950/80 px-3 py-2 text-left text-xs font-medium text-red-200 ring-1 ring-red-900 transition-colors hover:bg-red-950"
          >
            Delete track
          </button>
        </>
      )}
    </div>
  );
}
