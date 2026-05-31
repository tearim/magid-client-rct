import { useState, useCallback, useRef } from 'react';
import type { ParsedElement } from '../lib/elementFactory';
import { MagidRoot } from './MagidRoot';

interface Props {
  elements: ParsedElement[];
}

function initialUnlocked(elements: ParsedElement[]): number {
  const firstBlocker = elements.findIndex(
    (el) => el.type === 'visual' && el.data['transition-blocking'] === 'true'
  );
  return firstBlocker === -1 ? elements.length : firstBlocker + 1;
}

export function ResponsesContainer({ elements }: Props) {
  const prevElementsRef = useRef(elements);
  const [unlockedCount, setUnlockedCount] = useState(() => initialUnlocked(elements));

  // Reset unlock state when elements prop identity changes (new server response)
  if (prevElementsRef.current !== elements) {
    prevElementsRef.current = elements;
    setUnlockedCount(initialUnlocked(elements));
  }

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

  const visible = elements.slice(0, unlockedCount);

  return (
    <>
      {visible.map((el, i) => {
        const isBlockingVisual =
          el.type === 'visual' && el.data['transition-blocking'] === 'true';
        return (
          <MagidRoot
            key={i}
            elements={[el]}
            onVisualComplete={isBlockingVisual ? handleComplete : undefined}
          />
        );
      })}
    </>
  );
}
