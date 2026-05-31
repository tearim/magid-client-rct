import { useCallback } from 'react';
import { useMagidStore } from '../store/magidStore';

export function useMagidCommand(): (cmd: string) => void {
  const sendCommand = useMagidStore((s) => s.sendCommand);
  return useCallback((cmd: string) => { void sendCommand(cmd); }, [sendCommand]);
}
