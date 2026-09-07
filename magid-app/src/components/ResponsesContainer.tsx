import { useState, useCallback, useEffect, useRef } from 'react';
import type { ParsedElement } from '../lib/elementFactory';
import { MagidElement } from './MagidRoot';

interface Props {
  elements: ParsedElement[];
}

function initialUnlocked(elements: ParsedElement[]): number {
  const firstBlocker = elements.findIndex(
    (el) => el.type === 'visual' && el.data['transition-blocking'] === 'true'
  );
  return firstBlocker === -1 ? elements.length : firstBlocker + 1;
}

function getNarrationDeferMs(el: ParsedElement): number {
  if (el.type !== 'narration') return 0;

  const deferMs = el.data.defer ? parseInt(el.data.defer, 10) : 0;
  return Number.isFinite(deferMs) ? deferMs : 0;
}

export function ResponsesContainer({ elements }: Props) {
  const [unlockedCount, setUnlockedCount] = useState(() => initialUnlocked(elements));
  const [visibleNarrationCount, setVisibleNarrationCount] = useState(1);
  const prevElementsRef = useRef(elements);

  // Reset unlock/queue state only when elements actually change (not on initial mount).
  useEffect(() => {
    if (prevElementsRef.current === elements) return;
    prevElementsRef.current = elements;
    setUnlockedCount(initialUnlocked(elements));
    setVisibleNarrationCount(1);
  }, [elements]);

  const handleComplete = useCallback(() => {
    setUnlockedCount((prev) => {
      if (prev >= elements.length) return prev;

      // Find next blocking visual after current position
      const next = elements.findIndex(
        (el, i) =>
          i >= prev &&
          el.type === 'visual' &&
          el.data['transition-blocking'] === 'true'
      );

      return next === -1 ? elements.length : next + 1;
    });
  }, [elements]);

  const handleNarrationComplete = useCallback(() => {
    setVisibleNarrationCount((count) => count + 1);
  }, []);

  const visible = elements.slice(0, unlockedCount);
  let queuedNarrationIndex = 0;

  return (
    <>
      {visible.map((el, i) => {
        const isBlockingVisual =
          el.type === 'visual' && el.data['transition-blocking'] === 'true';

        if (el.type !== 'narration') {
          return (
            <MagidElement
              key={i}
              el={el}
              onVisualComplete={isBlockingVisual ? handleComplete : undefined}
            />
          );
        }

        const deferMs = getNarrationDeferMs(el);

        if (deferMs > 0) {
          return (
            <MagidElement
              key={i}
              el={el}
              onVisualComplete={isBlockingVisual ? handleComplete : undefined}
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
            onVisualComplete={isBlockingVisual ? handleComplete : undefined}
            onNarrationComplete={isActiveNarration ? handleNarrationComplete : undefined}
          />
        );
      })}
    </>
  );
}
