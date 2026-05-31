import { useEffect, useRef } from 'react';
import type { VisualResponse } from '../types/protocol';

interface Props {
  data: VisualResponse;
  onComplete?: () => void;
}

export function VisualFade({ data, onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const transitionType = data['transition-type'];
  const durationMs = parseInt(data['transition-length'] ?? '400', 10);
  const target = data['transition-target'] ?? '#000000';
  const blocking = data['transition-blocking'] === 'true';

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const isFade = transitionType === 'fade';
    el.style.opacity = isFade ? '1' : '0';
    el.style.transition = 'none';

    // Force a reflow so the initial opacity is applied before we start transitioning
    void el.offsetHeight;

    el.style.transition = `opacity ${durationMs}ms ease`;
    el.style.opacity = isFade ? '0' : '1';

    if (blocking && onComplete) {
      const t = setTimeout(onComplete, durationMs);
      return () => clearTimeout(t);
    }
  }, [transitionType, durationMs, blocking, onComplete]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: target,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
