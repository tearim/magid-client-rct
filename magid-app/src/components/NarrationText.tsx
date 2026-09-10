import { useState, useEffect, useRef } from 'react';
import type { NarrationResponse } from '../types/protocol';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { parseMagidCss } from '../lib/magidCss';
import { renderWithBreaks, TypingStyle } from '../lib/renderText';
import { resolveCleanText } from '../lib/textTimeline';

const NAMED_SPEEDS: Record<string, number> = {
  slow: 30,
  normal: 20,
  fast: 10,
  rapid: 5,
};

export function getConsequentalTypingConfig(className?: string): { typeEachLetter: boolean; typeEachWord: boolean; typeElementMs: number, animationResets: number } {
  if (!className) return { typeEachLetter: false, typeEachWord: false,  typeElementMs: 0, animationResets: 0  };
  const match = className.match(/\btype-by-letter-(\S+)/);
  const wordMatch= className.match(/\btype-by-word-(\S+)/);
  const resetsMatch = className.match(/\banimation-resets-(\S+)/);
  let resets = 0;
  if (resetsMatch) {
    resets = parseInt(resetsMatch[1], 10);
  }

  if (!match && !wordMatch) return { typeEachLetter: false, typeEachWord: false, typeElementMs: 0, animationResets: 0 };

  const workingMatch = match ? match : wordMatch;
  if ( !workingMatch ) return { typeEachLetter: false, typeEachWord: false,  typeElementMs: 0, animationResets: resets  };
  const tEL = match !== null  ;
  const tEW = wordMatch !== null;
  const value = workingMatch[1];
  if (value in NAMED_SPEEDS) {
    return { typeEachLetter: tEL, typeEachWord: tEW, typeElementMs: NAMED_SPEEDS[value], animationResets: resets  };
  }

  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { typeEachLetter: tEL, typeEachWord: tEW, typeElementMs: parsed, animationResets: resets  };
  }

  return { typeEachLetter: false, typeEachWord: false, typeElementMs: 0, animationResets: 0  };
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

  const consequentalTypingConfig = getConsequentalTypingConfig(data.class);
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

  const classes = ['magid-default-narration', data.class].filter(Boolean).join(' ');
  const style = data.css ? parseMagidCss(data.css) : undefined;

  let typingStyle = undefined;
  if ( consequentalTypingConfig.typeEachLetter ) {
    typingStyle = TypingStyle.byLetter;
  }
  if ( consequentalTypingConfig.typeEachLetter && data.class?.includes(("animate-independent") ) ) {
    typingStyle = TypingStyle.byLetterIsolating;
  }
  if ( consequentalTypingConfig.typeEachWord ) {
    typingStyle = TypingStyle.byWord;
  }
  if ( consequentalTypingConfig.typeEachWord && data.class?.includes(("animate-independent") ) ) {
    typingStyle = TypingStyle.byWordIsolating;
  }
  return (
      <div className={classes} style={style}>
        {renderWithBreaks(displayed, typingStyle, consequentalTypingConfig.animationResets)}
      </div>
  );
}