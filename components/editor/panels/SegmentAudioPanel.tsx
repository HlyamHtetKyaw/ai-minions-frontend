'use client';

import { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SegmentAudioPanel() {
  const videoSegments = useEditorStore((s) => s.videoSegments);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const updateVideoSegment = useEditorStore((s) => s.updateVideoSegment);

  const segment = useMemo(
    () => videoSegments.find((item) => item.id === selectedSegmentId),
    [selectedSegmentId, videoSegments],
  );

  if (!segment) return null;

  const segmentDuration = Math.max(0, segment.endTime - segment.startTime);
  const maxFade = segmentDuration / 2;
  const sliderAccent =
    segment.volume === 0 ? 'accent-red-500' : segment.volume === 100 ? 'accent-[#534AB7]' : 'accent-[#7F77DD]';

  return (
    <div className="flex flex-col gap-4 border-t border-zinc-800 p-3">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Segment audio</h3>
        <p className="mt-1 text-[11px] text-zinc-500">
          {segment.startTime.toFixed(1)}s — {segment.endTime.toFixed(1)}s
        </p>
        <p className="text-[11px] text-zinc-500">{segmentDuration.toFixed(1)}s</p>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-300">
          <span>Volume</span>
          <span>{segment.volume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={segment.volume}
          onChange={(e) => updateVideoSegment(segment.id, { volume: Number(e.target.value) })}
          className={`w-full ${sliderAccent}`}
        />
      </section>

      <button
        type="button"
        onClick={() => updateVideoSegment(segment.id, { isMuted: !segment.isMuted })}
        className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${
          segment.isMuted
            ? 'bg-red-700 text-white'
            : 'border border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
        }`}
      >
        {segment.isMuted ? 'Unmute segment' : 'Mute segment'}
      </button>

      <section>
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-300">
          <span>Fade in</span>
          <span>{segment.fadeIn.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxFade}
          step={0.1}
          value={segment.fadeIn}
          onChange={(e) =>
            updateVideoSegment(segment.id, {
              fadeIn: clamp(Number(e.target.value), 0, maxFade),
            })
          }
          className="w-full accent-[#534AB7]"
        />
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-300">
          <span>Fade out</span>
          <span>{segment.fadeOut.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxFade}
          step={0.1}
          value={segment.fadeOut}
          onChange={(e) =>
            updateVideoSegment(segment.id, {
              fadeOut: clamp(Number(e.target.value), 0, maxFade),
            })
          }
          className="w-full accent-[#534AB7]"
        />
      </section>

      <button
        type="button"
        onClick={() => {
          if (!window.confirm('Apply these audio settings to all segments?')) return;
          useEditorStore.setState((state) => ({
            videoSegments: state.videoSegments.map((item) => ({
              ...item,
              volume: segment.volume,
              fadeIn: clamp(segment.fadeIn, 0, Math.max(0, (item.endTime - item.startTime) / 2)),
              fadeOut: clamp(segment.fadeOut, 0, Math.max(0, (item.endTime - item.startTime) / 2)),
            })),
          }));
        }}
        className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
      >
        Apply to all segments
      </button>

      <button
        type="button"
        onClick={() =>
          updateVideoSegment(segment.id, {
            volume: 100,
            isMuted: false,
            fadeIn: 0,
            fadeOut: 0,
          })
        }
        className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
      >
        Reset
      </button>
    </div>
  );
}
