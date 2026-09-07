import { useState, useEffect, useRef } from 'react';
import type { NarrationResponse } from '../types/protocol';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { parseMagidCss } from '../lib/magidCss';
import { renderWithBreaks } from '../lib/renderText';

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

  const displayed = useTypewriter(rawText, skipTimelines);
  const completed = normalizedDeferMs === 0 && visible && displayed === rawText;

  useEffect(() => {
    console.log("Completed? ", completed)
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