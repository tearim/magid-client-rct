import { useState, useEffect, useRef } from 'react';
import { getConsequentalTypingConfig, parseMagidCss, resolveCleanText, type NarrationResponse } from '@magid/client-core';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { renderWithBreaks, TypingStyle } from '../lib/renderText';
import { useImpliedClasses } from '../hooks/useImpliedClasses';

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
  const className = useImpliedClasses(data.class);

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


  const consequentalTypingConfig = getConsequentalTypingConfig(className);
  const displayed = useTypewriter(rawText, skipTimelines, consequentalTypingConfig);
  const cleanText = resolveCleanText(rawText);
  const completed = normalizedDeferMs === 0 && visible && displayed === cleanText;

  useEffect(() => {
    if (!completed) return;
    if (completionReportedRef.current) return;

    completionReportedRef.current = true;
    onComplete?.();
  }, [completed, onComplete]);

  if (!visible) return null;

  const classes = ['magid-default-narration', className].filter(Boolean).join(' ');
  const style = data.css ? parseMagidCss(data.css) : undefined;


  let typingStyle = undefined;
  if ( consequentalTypingConfig.typeEachLetter ) {
    typingStyle = TypingStyle.byLetter;
  }
  if ( consequentalTypingConfig.typeEachLetter && className?.includes(("animate-independent") ) ) {
    typingStyle = TypingStyle.byLetterIsolating;
  }
  if ( consequentalTypingConfig.typeEachWord ) {
    typingStyle = TypingStyle.byWord;
  }
  if ( consequentalTypingConfig.typeEachWord && className?.includes(("animate-independent") ) ) {
    typingStyle = TypingStyle.byWordIsolating;
  }


  return (
      <div className={classes} style={style}>
        {renderWithBreaks(displayed, typingStyle, consequentalTypingConfig.animationResets)}
      </div>
  );
}