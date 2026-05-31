import type { ParsedElement } from '../lib/elementFactory';
import { MenuScene } from './MenuScene';
import { NarrationText } from './NarrationText';
import { CommandButton } from './CommandButton';
import { VisualFade } from './VisualFade';
import { ResponsesContainer } from './ResponsesContainer';
import { useMagidCommand } from '../hooks/useMagidCommand';
import styles from './MagidRoot.module.css';

interface Props {
  elements: ParsedElement[];
  onVisualComplete?: () => void;
}

export function MagidRoot({ elements, onVisualComplete }: Props) {
  const sendCmd = useMagidCommand();

  return (
    <div className={`magid-response-pane ${styles.responsePane}`}>
      {elements.map((el, i) => {
        switch (el.type) {
          case 'menu':
            return <MenuScene key={i} data={el.data} />;
          case 'narration':
            return <NarrationText key={i} data={el.data} />;
          case 'command':
            return <CommandButton key={i} data={el.data} onClick={sendCmd} />;
          case 'visual':
            return <VisualFade key={i} data={el.data} onComplete={onVisualComplete} />;
          case 'responses':
            return <ResponsesContainer key={i} elements={el.elements} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
