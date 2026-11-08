import { useState, useEffect, useMemo } from 'react';
import { typingSchedule } from '@magiden/client-core';

interface TypewriterOptions {
  typeEachLetter?: boolean;
  typeEachWord?: boolean;
  typeElementMs?: number;
  animationResets?: number;
}

// Plays @magiden/client-core's typingSchedule (DCSTP_ offsets, typing by letter or word): returns the visible part of
// the clean (marker-free) text. A complete text equals resolveCleanText(raw), also when the timeline is skipped.
export function useTypewriter(raw: string, skip: boolean, options?: TypewriterOptions): string {
  const [displayed, setDisplayed] = useState('');
  const typeEachLetter = options?.typeEachLetter === true;
  const typeEachWord = options?.typeEachWord === true;
  const typeElementMs = Number.isFinite(options?.typeElementMs) ? Number(options?.typeElementMs) : 0;
  const { text, steps } = useMemo(
    () => typingSchedule(raw, { typeEachLetter, typeEachWord, typeElementMs }, skip),
    [raw, skip, typeEachLetter, typeEachWord, typeElementMs],
  );

  useEffect(() => {
    if (steps.length === 0) return;
    setDisplayed('');
    const timers = steps.map((step) => setTimeout(() => setDisplayed(text.slice(0, step.length)), step.at));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [text, steps]);

  // Nothing to type: the whole text at once, without a blank first render (effects run after paint).
  return steps.length === 0 ? text : displayed;
}
