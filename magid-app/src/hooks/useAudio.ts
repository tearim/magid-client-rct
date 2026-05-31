import { useEffect, useRef } from 'react';

export function useAudio(src: string | undefined, volume: number): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!src) return;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    audioRef.current = audio;
    audio.play().catch(() => {});

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [src, volume]);
}
