import { useCallback, useEffect, useState } from 'react';
import type { ParsedElement } from '../lib/elementFactory';
import { MenuScene } from './MenuScene';
import { NarrationText } from './NarrationText';
import { CommandButton } from './CommandButton';
import { VisualFade } from './VisualFade';
import { ResponsesContainer } from './ResponsesContainer';
import { useMagidCommand } from '../hooks/useMagidCommand';
import styles from './MagidRoot.module.css';

interface ElementProps {
  el: ParsedElement;
  onVisualComplete?: () => void;
  onNarrationComplete?: () => void;
}

function getNarrationDeferMs(el: ParsedElement): number {
  if (el.type !== 'narration') return 0;

  const deferMs = el.data.defer ? parseInt(el.data.defer, 10) : 0;
  return Number.isFinite(deferMs) ? deferMs : 0;
}

export function MagidElement({ el, onVisualComplete, onNarrationComplete }: ElementProps) {
  const sendCmd = useMagidCommand();

  switch (el.type) {
    case 'menu':      return <MenuScene data={el.data} />;
    case 'narration': return <NarrationText data={el.data} onComplete={onNarrationComplete} />;
    case 'command':   return <CommandButton data={el.data} onClick={sendCmd} />;
    case 'visual':    return <VisualFade data={el.data} onComplete={onVisualComplete} />;
    case 'responses': return <ResponsesContainer elements={el.elements} />;
    case 'detached':  return null; // spliced into a menu's description by the store; nothing to render standalone
    default:          return null;
  }
}

interface Props {
  elements: ParsedElement[];
  onVisualComplete?: () => void;
}

export function MagidRoot({ elements, onVisualComplete }: Props) {
  const [visibleNarrationCount, setVisibleNarrationCount] = useState(1);

  useEffect(() => {
    setVisibleNarrationCount(1);
  }, [elements]);

  const handleNarrationComplete = useCallback(() => {
    setVisibleNarrationCount((count) => count + 1);
  }, []);

  let queuedNarrationIndex = 0;

  return (
      <div className={`magid-response-pane ${styles.responsePane}`}>
        {elements.map((el, i) => {
          if (el.type !== 'narration') {
            return (
                <MagidElement
                    key={i}
                    el={el}
                    onVisualComplete={onVisualComplete}
                />
            );
          }

          const deferMs = getNarrationDeferMs(el);

          if (deferMs > 0) {
            return (
                <MagidElement
                    key={i}
                    el={el}
                    onVisualComplete={onVisualComplete}
                />
            );
          }

          const currentQueuedNarrationIndex = queuedNarrationIndex;
          queuedNarrationIndex += 1;

          if (currentQueuedNarrationIndex >= visibleNarrationCount) {
            return null;
          }

          const isActiveNarration =
              currentQueuedNarrationIndex === visibleNarrationCount - 1;

          return (
              <MagidElement
                  key={i}
                  el={el}
                  onVisualComplete={onVisualComplete}
                  onNarrationComplete={isActiveNarration ? handleNarrationComplete : undefined}
              />
          );
        })}
      </div>
  );
}