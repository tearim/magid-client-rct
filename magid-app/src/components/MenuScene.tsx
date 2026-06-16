import { useEffect, useRef } from 'react';
import type { MenuResponse } from '../types/protocol';
import { CommandButton } from './CommandButton';
import { useAudio } from '../hooks/useAudio';
import { useTypewriter } from '../hooks/useTypewriter';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { useMagidCommand } from '../hooks/useMagidCommand';
import { renderWithBreaks } from '../lib/renderText';

interface Props {
  data: MenuResponse;
}

export function MenuScene({ data }: Props) {
  const sendCmd = useMagidCommand();
  const descRef = useRef<HTMLDivElement>(null);
  const volume = prefs.getDouble(PREF_KEYS.MUSIC_VOLUME) || 0.8;
  const skipTimelines = prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL);
  const rawDesc = data['menu-description'] ?? '';
  const displayed = useTypewriter(rawDesc, skipTimelines);

  useAudio(data['menu-background-music'], volume);

  useEffect(() => {
    if (descRef.current && data['menu-css']) {
      descRef.current.style.cssText = data['menu-css'];

      // Handle special -mg- properties
      const css = data['menu-css'];
      const wMatch = css.match(/-mg-window-width\s*:\s*(\d+)/);
      const hMatch = css.match(/-mg-window-height\s*:\s*(\d+)/);
      if (wMatch) document.documentElement.style.width = wMatch[1] + 'px';
      if (hMatch) document.documentElement.style.height = hMatch[1] + 'px';
    }
  }, [data]);

  const options = data['menu-options'] ?? [];
  const n = options.length;

  return (
    <div className="magid-menu-textarea">
      {rawDesc && (
        <div ref={descRef} className="magid-menu-description">
          {renderWithBreaks(displayed)}
        </div>
      )}
      <div className="magid-menu-buttons">
        {options.map((opt, i) => (
          <CommandButton
            key={opt['command-name']}
            data={opt}
            onClick={sendCmd}
            positionClass={`button-${i + 1}-of-${n}`}
          />
        ))}
      </div>
    </div>
  );
}
