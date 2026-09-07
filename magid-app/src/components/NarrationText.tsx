import { useState, useEffect, useRef } from 'react';
import type { NarrationResponse } from '../types/protocol';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { parseMagidCss } from '../lib/magidCss';
import { renderWithBreaks } from '../lib/renderText';
import { resolveCleanText } from '../lib/textTimeline';

const NAMED_SPEEDS: Record<string, number> = {
  slow: 30,
  normal: 20,
  fast: 10,
  rapid: 5,
};

function getLetterTypingConfig(className?: string): { typeEachLetter: boolean; typeLetterMs: number } {
  if (!className) return { typeEachLetter: false, typeLetterMs: 0 };

  const match = className.match(/\btype-by-letter-(\S+)/);
  if (!match) return { typeEachLetter: false, typeLetterMs: 0 };

  const value = match[1];
  if (value in NAMED_SPEEDS) {
    return { typeEachLetter: true, typeLetterMs: NAMED_SPEEDS[value] };
  }

  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { typeEachLetter: true, typeLetterMs: parsed };
  }

  return { typeEachLetter: false, typeLetterMs: 0 };
}

interface Props {
  data: NarrationResponse;
  onComplete?: () => void;
}

export function NarrationText({ data, onComplete }: Props) {
  const rawText = data.narration ?? data.text ?? '';
  const deferMs = data.defer ? parseInt(data.defer, 10) : 0;
  const normalizedDeferMs = Number.isFinite(deferMs) ? deferMs : 0;
  const [visible, setVisible] = useState(normalizedDeferMs === 0);
  const [skipTimelines, setSkipTimelines] = useState(false);
  const completionReportedRef = useRef(false);

  useEffect(() => {
    setSkipTimelines(prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL));
  }, []);

  useEffect(() => {
    completionReportedRef.current = false;
    setVisible(normalizedDeferMs === 0);

    if (normalizedDeferMs === 0) return;

    const t = setTimeout(() => setVisible(true), normalizedDeferMs);
    return () => clearTimeout(t);
  }, [rawText, normalizedDeferMs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSkipTimelines(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const letterTypingConfig = getLetterTypingConfig(data.class);
  const displayed = useTypewriter(rawText, skipTimelines, letterTypingConfig);
  const cleanText = resolveCleanText(rawText);
  const completed = normalizedDeferMs === 0 && visible && displayed === cleanText;

  useEffect(() => {
    if (!completed) return;
    if (completionReportedRef.current) return;

    completionReportedRef.current = true;
    onComplete?.();
  }, [completed, onComplete]);

  if (!visible) return null;

  const classes = ['magid-default-narration', data.class].filter(Boolean).join(' ');
  const style = data.css ? parseMagidCss(data.css) : undefined;

  return (
      <div className={classes} style={style}>
        {renderWithBreaks(displayed)}
      </div>
  );
}