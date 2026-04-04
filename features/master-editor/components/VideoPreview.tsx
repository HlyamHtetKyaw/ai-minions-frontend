'use client';

import { useEffect, useRef } from 'react';

type Props = {
  src: string;
  filterStyle: string;
  /** HTML5 playback rate (e.g. 0.5–2) */
  playbackRate?: number;
};

export default function VideoPreview({ src, filterStyle, playbackRate = 1 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        style={{ filter: filterStyle || undefined }}
        className="aspect-video w-full object-contain"
      />
    </div>
  );
}
