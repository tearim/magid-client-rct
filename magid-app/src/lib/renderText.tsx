import {Fragment} from 'react';
import type { ReactNode } from 'react';

export const TypingStyle = {
    byLetter: 'byLetter',
    byLetterIsolating: 'byLetterIsolating',
    byWord: 'byWord',
    byWordIsolating: 'byWordIsolating'
} as const;
type TypingStyle = keyof typeof TypingStyle;

// Module-level state that was previously (incorrectly) stored in useRef hooks.
// renderWithBreaks is a plain helper function, not a React component, so it
// must not call hooks.  A single module-scoped cache is fine here because the
// values are only used for short-lived animation-reset bookkeeping.
let lastTimeCleared = Date.now();
let lastRawLineUsed: string[] = [];

export function renderWithBreaks(text: string, typingStyle?: TypingStyle, animationResets:number = 0  ): ReactNode {
    const lines = text.split(/\r?\n/);
    let needToClear = false;
    if ( animationResets > 0) {
        if (Date.now() > lastTimeCleared + animationResets) {
            needToClear = true;
            lastTimeCleared = Date.now();
        }
    }
    if ( typingStyle === TypingStyle.byLetterIsolating ) {
        return lines.map((line, i) => {
            const words = line.split(/\s/);
            return <Fragment key={i}>
                {i > 0 && <br/>}
                {words.map((word, _) => {
                    let result = [];
                    for ( let j = 0; j < word.length; j++) {
                        result.push(<span key={j} className={"animated"}>{word[j]}</span>)
                    }
                    return <span className={"word-joiner"}>{result} </span>
                })}
            </Fragment>
        });
    }
    if ( typingStyle === TypingStyle.byLetter ) {
        return lines.map((line, i) => {
            if (animationResets > 0) {
                if (lastRawLineUsed && lastRawLineUsed[i] === line && i === lines.length - 1) {
                    needToClear = false;
                }
                lastRawLineUsed[i] = line;
                if (needToClear && i === lines.length - 1) {
                    lastTimeCleared = Date.now();
                    needToClear = false;
                    return <Fragment key={i}>
                        {i > 0 && <br/>}
                        {line}
                    </Fragment>
                }
            }
            return <Fragment key={i}>
                {i > 0 && <br/>}
                {line.substring(0, line.length - 4)}
                <span className={"lastchar3"}>{line.substring(line.length - 4, line.length - 3)}</span>
                <span className={"lastchar2"}>{line.substring(line.length - 3, line.length - 2)}</span>
                <span className={"lastchar1"}>{line.substring(line.length - 2, line.length - 1)}</span>
                <span className={"lastchar"}>{line.substring(line.length - 1, line.length)}</span>
            </Fragment>
        });
    }
    if (typingStyle === TypingStyle.byWord || typingStyle === TypingStyle.byWordIsolating ) {

      return lines.map((line, i) => {
         if ( lastRawLineUsed && lastRawLineUsed[i] === line && i === lines.length - 1) {
             needToClear = false;
         }
         lastRawLineUsed[i] = line;
         let words = line.trim().split(/\s+/);
         if ( typingStyle === TypingStyle.byWordIsolating ) {
             return <Fragment key={i}>
                 {words.map((word, j) => <span key={j} className={"animated"}>{word} </span>)}
             </Fragment>
         }
         const lastWords = words.splice(-4);
         const remainder = words.join(" ");
         if ( needToClear && i === lines.length - 1) {
             lastTimeCleared = Date.now();
             needToClear = false;
             return <Fragment key={i}>
                 {i > 0 && <br/>}
                 {line}
             </Fragment>
         }
         return <Fragment key={i}>
             {i > 0 && <br/>}
             {remainder}
             {lastWords[0] !== undefined ? <span className={"lastchar3"}> {lastWords[0]}</span> : null}
             {lastWords[1] !== undefined ? <span className={"lastchar2"}> {lastWords[1]}</span> : null}
             {lastWords[2] !== undefined ? <span className={"lastchar1"}> {lastWords[2]}</span> : null}
             {lastWords[3] !== undefined ? <span className={"lastchar"}> {lastWords[3]}</span> : null}
          </Fragment>
     });
    }
    return lines.map((line, i) => {
    return <Fragment key={i}>
        {i > 0 && <br/>}
        {line}
    </Fragment>
    });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Like renderWithBreaks, but any occurrence of an anchor key (literal substring)
// is swapped for its mapped node instead of being rendered as text. An anchor
// only takes effect once its full token has actually appeared in `text` — e.g.
// while a typewriter effect is still revealing text up to that point, the anchor
// renders nothing until the token lands, so its raw id never flashes on screen.
export function renderTextWithAnchors(text: string, anchors: Record<string, ReactNode>): ReactNode {
  const keys = Object.keys(anchors).filter(Boolean);
  if (keys.length === 0) return renderWithBreaks(text);

  const pattern = new RegExp(`(${keys.map(escapeRegExp).join('|')})`, 'g');
  const parts = text.split(pattern);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {Object.prototype.hasOwnProperty.call(anchors, part)
          ? anchors[part]
          : renderWithBreaks(part)}
    </Fragment>
  ));
}
