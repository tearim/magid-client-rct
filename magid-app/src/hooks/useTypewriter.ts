import { useState, useEffect } from 'react';
import { hasTypewriterAnimation, parseTextSegments } from '../lib/textTimeline';

interface TypewriterOptions {
  typeEachLetter?: boolean;
  typeLetterMs?: number;
}

export function useTypewriter(raw: string, skip: boolean, options?: TypewriterOptions): string {
  const [displayed, setDisplayed] = useState('');
  const typeEachLetter = options?.typeEachLetter === true;
  const typeLetterMs = Number.isFinite(options?.typeLetterMs) ? Number(options?.typeLetterMs) : 0;

  useEffect(() => {
    if (!typeEachLetter && ( skip || !hasTypewriterAnimation(raw) )) {
      setDisplayed(raw);
      return;
    }
    setDisplayed('');
    const segments = parseTextSegments(raw);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let accumulatedOffset = 0;
    let accumulatedDelayMs = 0;
    let lastSegDelayMs = 0;
    let cleanPrefix = '';
    for (const seg of segments) {
      if ( typeEachLetter ) {
        console.log("begin chunk")
        const prefix = cleanPrefix;
        accumulatedDelayMs = seg.offsetMs + lastSegDelayMs;
        console.log('clean prefix @', accumulatedDelayMs, cleanPrefix );
        for (let i = 0; i < seg.text.length; i++) {
           timers.push(setTimeout(() => {
             setDisplayed(prefix + seg.text.substring(0, i+1) );
           }, accumulatedDelayMs + i * typeLetterMs));
        }
        lastSegDelayMs += seg.text.length * typeLetterMs;

        cleanPrefix += seg.text;
      } else {
        const t = setTimeout(() => {
          setDisplayed((prev) => prev + seg.text);
        }, seg.offsetMs);
        timers.push(t);
      }

      accumulatedOffset += seg.text.length;
    }

    // After all segments complete, set displayed to the clean (marker-free) text
    // so that DCSTP_ markers never flash on screen.
    if (segments.length > 0) {
      const cleanText = segments.map((s) => s.text).join('');
      const lastSeg = segments[segments.length - 1];
      const finalMs = typeEachLetter ? accumulatedDelayMs + 1 + lastSegDelayMs : lastSeg.offsetMs + 1;
      timers.push(setTimeout(() => setDisplayed(cleanText), finalMs));
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [raw, skip, typeEachLetter, typeLetterMs]);

  // For non-animated text bypass state entirely — avoids a blank first render
  // because useEffect runs after paint, not during.
  if (!typeEachLetter && ( skip || !hasTypewriterAnimation(raw) )) return raw;
  // When animation is complete, never return raw markers — displayed is already clean.
  return displayed;
}
