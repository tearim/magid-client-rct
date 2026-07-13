import type { ReactNode } from 'react';
import type { DetachedElementResponse } from '../types/protocol';
import { InputElement } from './InputElement';

interface Props {
  data: DetachedElementResponse;
}

// Single source of truth: maps element-type → renderer. Add new element types here only.
const DETACHED_ELEMENT_RENDERERS: Record<string, (data: DetachedElementResponse) => ReactNode> = {
  input: (data) => <InputElement data={data} />,
};

export function DetachedElement({ data }: Props) {
  const render = DETACHED_ELEMENT_RENDERERS[data['element-type']];
  if (!render) {
    console.warn(`[magid] Unknown detached element-type: ${data['element-type']}`);
    return null;
  }
  return <>{render(data)}</>;
}
