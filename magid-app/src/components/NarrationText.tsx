import { useState, useEffect, useRef } from 'react';
import type { NarrationResponse } from '../types/protocol';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';

interface Props {
  data: NarrationResponse;
}

export function NarrationText({ data }: Props) {
  const rawText = data.narration ?? data.text ?? '';
  const deferMs = data.defer ? parseInt(data.defer, 10) : 0;
  const [visible, setVisible] = useState(deferMs === 0);
  const [skipTimelines, setSkipTimelines] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSkipTimelines(prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL));
  }, []);

  useEffect(() => {
    if (deferMs === 0) return;
    const t = setTimeout(() => setVisible(true), deferMs);
    return () => clearTimeout(t);
  }, [deferMs]);

  // Escape key skips typewriter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSkipTimelines(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const displayed = useTypewriter(rawText, skipTimelines);

  useEffect(() => {
    if (divRef.current && data.css) {
      divRef.current.style.cssText = data.css;
    }
  }, [data.css]);

  if (!visible) return null;

  const classes = ['magid-default-narration', data.class].filter(Boolean).join(' ');

  return (
    <div ref={divRef} className={classes}>
      {displayed}
    </div>
  );
}
