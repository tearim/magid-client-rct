import { useState, useEffect } from 'react';
import type { CommandResponse } from '../types/protocol';
import { useMagidStore } from '../store/magidStore';
import { parseMagidCss } from '../lib/magidCss';
import { useImpliedClasses } from '../hooks/useImpliedClasses';

interface Props {
  data: CommandResponse;
  onClick: (cmd: string) => void;
  positionClass?: string;
}

export function CommandButton({ data, onClick, positionClass }: Props) {
  const isLoading = useMagidStore((s) => s.isLoading);
  const deferMs = data['command-defer'] ? parseInt(data['command-defer'], 10) : 0;
  const [visible, setVisible] = useState(deferMs === 0);
  const commandClass = useImpliedClasses(data['command-class']);

  useEffect(() => {
    if (deferMs === 0) return;
    const t = setTimeout(() => setVisible(true), deferMs);
    return () => clearTimeout(t);
  }, [deferMs]);

  if (!visible) return null;

  const classes = ['magid-common-button', commandClass, positionClass]
    .filter(Boolean)
    .join(' ');
  const style = data['command-css'] ? parseMagidCss(data['command-css']) : undefined;

  return (
    <button
      className={classes}
      style={style}
      disabled={isLoading}
      onClick={() => onClick(data['command-name'] ?? (data as unknown as Record<string, string>)['command-text'] ?? '')}
      aria-label={data['command-description']}
    >
      {data['command-description']}
    </button>
  );
}
