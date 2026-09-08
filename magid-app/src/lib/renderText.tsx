import { Fragment } from 'react';
import type { ReactNode } from 'react';

export const TypingStyle = {
    byLetter: 'byLetter',
    byWord: 'byWord'
} as const;
type TypingStyle = keyof typeof TypingStyle;

export function renderWithBreaks(text: string, typingStyle?: TypingStyle  ): ReactNode {
      const lines = text.split(/\r?\n/);
      if ( typingStyle === TypingStyle.byLetter) {

          return lines.map((line, i) => (
              <Fragment key={i}>
                  {i > 0 && <br/>}
                  {line.substring(0, line.length - 4)}
                  <span className={"lastchar3"}>{line.substring(line.length - 4, line.length - 3)}</span>
                  <span className={"lastchar2"}>{line.substring(line.length - 3, line.length - 2)}</span>
                  <span className={"lastchar1"}>{line.substring(line.length - 2, line.length - 1)}</span>
                  <span className={"lastchar"}>{line.substring(line.length - 1, line.length)}</span>
              </Fragment>
          ));
      }
      if (typingStyle === TypingStyle.byWord) {
          return lines.map((line, i) => {
             let words = line.trim().split(/\s+/);
             const lastWords = words.splice(-4);
             const remainder = words.join(" ");
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
      {Object.prototype.hasOwnProperty.call(anchors, part) ? anchors[part] : renderWithBreaks(part)}
    </Fragment>
  ));
}
