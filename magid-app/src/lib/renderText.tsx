import { Fragment } from 'react';
import type { ReactNode } from 'react';

export function renderWithBreaks(text: string): ReactNode {
  const lines = text.split(/\r?\n/);
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}
