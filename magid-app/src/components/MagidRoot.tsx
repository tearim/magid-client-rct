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
}

export function MagidElement({ el, onVisualComplete }: ElementProps) {
  const sendCmd = useMagidCommand();
  switch (el.type) {
    case 'menu':      return <MenuScene data={el.data} />;
    case 'narration': return <NarrationText data={el.data} />;
    case 'command':   return <CommandButton data={el.data} onClick={sendCmd} />;
    case 'visual':    return <VisualFade data={el.data} onComplete={onVisualComplete} />;
    case 'responses': return <ResponsesContainer elements={el.elements} />;
    default:          return null;
  }
}

interface Props {
  elements: ParsedElement[];
  onVisualComplete?: () => void;
}

export function MagidRoot({ elements, onVisualComplete }: Props) {
  return (
    <div className={`magid-response-pane ${styles.responsePane}`}>
      {elements.map((el, i) => (
        <MagidElement key={i} el={el} onVisualComplete={onVisualComplete} />
      ))}
    </div>
  );
}
