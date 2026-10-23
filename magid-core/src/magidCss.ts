const POSITIONAL = new Set(['left', 'right', 'top', 'bottom']);
const UNIT_LESS = /^-?\d+(\.\d+)?$/;

// Magid's own positioning, as in the JFX client (UiElement.placeOnRegion): -mg-abs-x/-y place the element like
// left/top and win over them. The other -mg-* properties are about the desktop window (-mg-window-width/-height/
// -resizable, -mg-resizable, -mg-screen) and have no per-element meaning here; they are dropped, like -fx-*.
const MAGID_POSITIONAL: Record<string, string> = { '-mg-abs-x': 'left', '-mg-abs-y': 'top' };

// Inline style object with camelCased keys: usable as a React `style` prop or via Object.assign(el.style, …).
export type MagidStyle = Record<string, string>;

export function parseMagidCss(raw: string): MagidStyle {
  const style: Record<string, string> = {};
  let needsAbsolute = false;
  const magidPosition: Record<string, string> = {};

  for (const declaration of raw.split(';')) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;

    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();

    if (MAGID_POSITIONAL[prop]) {
      magidPosition[MAGID_POSITIONAL[prop]] = UNIT_LESS.test(value) ? `${value}px` : value;
      continue;
    }
    if (prop.startsWith('-fx-') || prop.startsWith('-mg-')) continue;

    if (POSITIONAL.has(prop)) {
      needsAbsolute = true;
      style[prop] = UNIT_LESS.test(value) ? `${value}px` : value;
    } else {
      const camelProp = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      style[camelProp] = value;
    }
  }

  for (const [prop, value] of Object.entries(magidPosition)) {
    style[prop] = value;
    needsAbsolute = true;
  }
  if (needsAbsolute) style.position = 'absolute';

  return style;
}
