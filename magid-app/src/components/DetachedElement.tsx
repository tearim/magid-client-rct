import type { ReactNode } from 'react';
import type { DetachedElementResponse } from '@magiden/client-core';
import { InputElement } from './InputElement';
import { MagidImage } from './MagidImage';

interface Props {
  data: DetachedElementResponse;
}

// Single source of truth: maps element-type → renderer. Add new element types here only.
const DETACHED_ELEMENT_RENDERERS: Record<string, (data: DetachedElementResponse) => ReactNode> = {
  input: (data) => <InputElement data={data} />,
  image: (data) => <MagidImage data={data} />,
};

export function DetachedElement({ data }: Props) {
  const render = DETACHED_ELEMENT_RENDERERS[data['element-type']];
  if (!render) {
    console.warn(`[magid] Unknown detached element-type: ${data['element-type']}`);
    return null;
  }
  return <>{render(data)}</>;
}
