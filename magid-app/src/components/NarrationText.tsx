import { useState, useEffect, useMemo, useRef } from 'react';
import {
  getConsequentalTypingConfig, parseMagidCss, prepareDisplayText, resolveCleanText, truncateHtml, withFileRequestToken,
  type NarrationResponse,
} from '@magiden/client-core';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { renderWithBreaks, TypingStyle } from '../lib/renderText';
import { renderHtml } from '../lib/renderHtml';
import { useMagidStore } from '../store/magidStore';
import { useImpliedClasses } from '../hooks/useImpliedClasses';

interface Props {
  // `image` comes from `<show image="…">` (a narration with an image) or from `<img>` (`image-mode` "true": the
  // narration is the image, with `alt`/`width`/`height`). The core passes these through, `magid:///` already resolved,
  // but doesn't declare them yet.
  data: NarrationResponse & { image?: string; 'image-mode'?: string; alt?: string; width?: string; height?: string };
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
  const htmlPolicy = useMagidStore((s) => s.htmlPolicy);
  const baseUrl = useMagidStore((s) => s.baseUrl);
  const fileRequestToken = useMagidStore((s) => s.fileRequestToken);
  // Tags are parsed once; the typewriter only sees the visible text, so a tag appears whole, never typed out.
  const { nodes, timeline } = useMemo(
    () => prepareDisplayText(rawText, htmlPolicy, { baseUrl, fileRequestToken }),
    [rawText, htmlPolicy, baseUrl, fileRequestToken],
  );
  // Server files need the session's token; other URLs are left as they are.
  const imageSrc = data.image ? withFileRequestToken(data.image, baseUrl, fileRequestToken) : undefined;

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
  const displayed = useTypewriter(timeline, skipTimelines, consequentalTypingConfig);
  const cleanText = resolveCleanText(timeline);
  const completed = normalizedDeferMs === 0 && visible && displayed === cleanText;

  useEffect(() => {
    if (!completed) return;
    if (completionReportedRef.current) return;

    completionReportedRef.current = true;
    onComplete?.();
  }, [completed, onComplete]);

  if (!visible) return null;

  // In image mode the author's class and css belong to the image (`<img class="rounded">`), not to the narration.
  const imageMode = data['image-mode'] === 'true';
  const ownClass = imageMode ? undefined : className;
  const classes = ['magid-default-narration', ownClass].filter(Boolean).join(' ');
  const style = data.css && !imageMode ? parseMagidCss(data.css) : undefined;
  const imageClasses = ['magid-narration-image', imageMode ? className : undefined].filter(Boolean).join(' ');
  const imageStyle = {
    ...(imageMode && data.css ? parseMagidCss(data.css) : undefined),
    ...(data.width ? { width: cssLength(data.width) } : undefined),
    ...(data.height ? { height: cssLength(data.height) } : undefined),
  };


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
        {imageSrc && <img className={imageClasses} style={imageStyle} src={imageSrc} alt={data.alt ?? ''} />}
        {renderHtml(truncateHtml(nodes, displayed.length), (text, isLast) =>
          // The reveal effects (last letters/words) belong at the reveal edge; the isolating ones apply everywhere.
          isLast || typingStyle === TypingStyle.byLetterIsolating || typingStyle === TypingStyle.byWordIsolating
            ? renderWithBreaks(text, typingStyle, consequentalTypingConfig.animationResets)
            : renderWithBreaks(text))}
      </div>
  );
}
// `width="200"` means pixels, as in HTML; anything else (`50%`, `12em`) is a CSS length already.
function cssLength(value: string): string {
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
}
