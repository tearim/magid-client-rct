import { useState, useEffect } from 'react';
import { hasTypewriterAnimation, parseTextSegments } from '../lib/textTimeline';

export function useTypewriter(raw: string, skip: boolean): string {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (skip || !hasTypewriterAnimation(raw)) {
      setDisplayed(raw);
      return;
    }

    setDisplayed('');
    const segments = parseTextSegments(raw);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const seg of segments) {
      const t = setTimeout(() => {
        setDisplayed((prev) => prev + seg.text);
      }, seg.offsetMs);
      timers.push(t);
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [raw, skip]);

  // For non-animated text bypass state entirely — avoids a blank first render
  // because useEffect runs after paint, not during.
  if (skip || !hasTypewriterAnimation(raw)) return raw;
  return displayed;
}
