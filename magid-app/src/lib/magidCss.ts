import type { CSSProperties } from 'react';

const POSITIONAL = new Set(['left', 'right', 'top', 'bottom']);
const UNIT_LESS = /^-?\d+(\.\d+)?$/;

export function parseMagidCss(raw: string): CSSProperties {
  const style: Record<string, string> = {};
  let needsAbsolute = false;

  for (const declaration of raw.split(';')) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;

    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();

    if (prop.startsWith('-fx-') || prop.startsWith('-mg-')) continue;

    if (POSITIONAL.has(prop)) {
      needsAbsolute = true;
      style[prop] = UNIT_LESS.test(value) ? `${value}px` : value;
    } else {
      const camelProp = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      style[camelProp] = value;
    }
  }

  if (needsAbsolute) style.position = 'absolute';

  return style as CSSProperties;
}
