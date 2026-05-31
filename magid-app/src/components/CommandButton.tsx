import { useState, useEffect, useRef } from 'react';
import type { CommandResponse } from '../types/protocol';
import { useMagidStore } from '../store/magidStore';

interface Props {
  data: CommandResponse;
  onClick: (cmd: string) => void;
  positionClass?: string;
}

export function CommandButton({ data, onClick, positionClass }: Props) {
  const isLoading = useMagidStore((s) => s.isLoading);
  const deferMs = data['command-defer'] ? parseInt(data['command-defer'], 10) : 0;
  const [visible, setVisible] = useState(deferMs === 0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (deferMs === 0) return;
    const t = setTimeout(() => setVisible(true), deferMs);
    return () => clearTimeout(t);
  }, [deferMs]);

  useEffect(() => {
    if (btnRef.current && data['command-css']) {
      btnRef.current.style.cssText = data['command-css'];
    }
  }, [data]);

  if (!visible) return null;

  const classes = ['magid-common-button', data['command-class'], positionClass]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={btnRef}
      className={classes}
      disabled={isLoading}
      onClick={() => onClick(data['command-name'] ?? (data as unknown as Record<string, string>)['command-text'] ?? '')}
      aria-label={data['command-description']}
    >
      {data['command-description']}
    </button>
  );
}
