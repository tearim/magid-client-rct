import { useState, useEffect } from 'react';
import type { NarrationResponse } from '../types/protocol';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { parseMagidCss } from '../lib/magidCss';

interface Props {
  data: NarrationResponse;
}

export function NarrationText({ data }: Props) {
  const rawText = data.narration ?? data.text ?? '';
  const deferMs = data.defer ? parseInt(data.defer, 10) : 0;
  const [visible, setVisible] = useState(deferMs === 0);
  const [skipTimelines, setSkipTimelines] = useState(false);

  useEffect(() => {
    setSkipTimelines(prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL));
  }, []);

  useEffect(() => {
    if (deferMs === 0) return;
    const t = setTimeout(() => setVisible(true), deferMs);
    return () => clearTimeout(t);
  }, [deferMs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSkipTimelines(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const displayed = useTypewriter(rawText, skipTimelines);

  if (!visible) return null;

  const classes = ['magid-default-narration', data.class].filter(Boolean).join(' ');
  const style = data.css ? parseMagidCss(data.css) : undefined;

  return (
    <div className={classes} style={style}>
      {displayed}
    </div>
  );
}
