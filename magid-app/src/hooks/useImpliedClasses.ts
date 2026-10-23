import { useMemo } from 'react';
import { useMagidStore } from '../store/magidStore';
import { applyImpliedClasses } from '@magiden/client-core';

// className plus the classes implied by the server's `implied-classes-of:` vars; follows var changes.
export function useImpliedClasses(className: string | undefined): string | undefined {
  const envVars = useMagidStore((s) => s.envVars);
  return useMemo(() => applyImpliedClasses(className, envVars), [className, envVars]);
}
