'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Pause, Download } from 'lucide-react';

type Props = {
  src: string;
  filename: string;
};

export default function AudioPlayer({ src, filename }: Props) {
  const t = useTranslations('shared.audioPlayer');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleEnded = () => setIsPlaying(false);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
    setProgress(Number(e.target.value));
  };

  // --- NEW DOWNLOAD LOGIC ---
  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'audio-file.mp3';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: opens in new tab if the fetch is blocked by CORS
      window.open(src, '_blank');
    }
  };
  // ---------------------------

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="hidden"
      />
      
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? t('pause') : t('play')}
        className="shrink-0 rounded-full bg-primary p-2 text-primary-fg"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={handleSeek}
        aria-label="Seek"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
      />

      <button
        type="button"
        onClick={handleDownload}
        aria-label={t('download')}
        className="shrink-0 rounded-full p-2 text-muted hover:text-foreground transition-colors"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}