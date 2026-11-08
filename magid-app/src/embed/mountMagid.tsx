import { createRoot } from 'react-dom/client';
import '../index.css';
import App from '../App';
import { createMagidInstance, MagidContext, type MagidHost } from '../store/magidStore';
import { resolveMountOptions, type MagidMountOptions } from './options';

export interface MagidHandle {
  unmount(): void;
}

// The shadow root's own rules: the page's inherited styles (font, colour, …) stop at the border.
const HOST_CSS = ':host { all: initial; display: block; position: relative; }';

let mountCount = 0;

// Mounts a Magid instance into `element`. The full app (main.tsx) uses mode 'app' on #root; anything else embeds Magid
// into one element of a page that isn't Magid's own (see EMBEDDING-PLAN.md).
export function mountMagid(element: HTMLElement, options: MagidMountOptions = {}): MagidHandle {
  const resolved = resolveMountOptions(options);
  const embedded = resolved.mode === 'embedded';
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.className = embedded ? 'magid-app-root magid-embedded' : 'magid-app-root';

  let host: MagidHost;
  if (!embedded) {
    element.appendChild(root);
    host = {
      root,
      keyTarget: window,
      fullscreenTarget: document.documentElement,
      setWindowSize: (width, height) => sizeElement(document.documentElement, width, height),
      overlayTarget: null,
      stylesheets: { container: document.head, scope: null },
    };
  } else {
    // Focusable, so its keyboard shortcuts only react while Magid has focus.
    root.tabIndex = 0;
    let container: HTMLElement | ShadowRoot;
    let scope: string;
    if (resolved.isolation === 'shadow') {
      const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
      const hostStyle = document.createElement('style');
      hostStyle.textContent = HOST_CSS;
      shadow.appendChild(hostStyle);
      cleanups.push(() => hostStyle.remove());
      cleanups.push(addAppStyles(shadow));
      container = shadow;
      scope = ':host';
    } else {
      const id = String(++mountCount);
      element.setAttribute('data-magid-mount', id);
      cleanups.push(() => element.removeAttribute('data-magid-mount'));
      cleanups.push(addAppStyles(document.head));
      container = document.head;
      scope = `[data-magid-mount="${id}"]`;
    }
    (container === document.head ? element : (container as ShadowRoot)).appendChild(root);
    host = {
      root,
      keyTarget: root,
      fullscreenTarget: resolved.fullscreen === 'element' ? element : null,
      setWindowSize: (width, height) => sizeElement(root, width, height),
      overlayTarget: root,
      stylesheets: { container, scope },
    };
  }

  const instance = createMagidInstance(resolved, host);
  const reactRoot = createRoot(root);
  reactRoot.render(
    <MagidContext.Provider value={instance}>
      <App />
    </MagidContext.Provider>,
  );

  return {
    unmount() {
      reactRoot.unmount();
      instance.dispose();
      root.remove();
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}

function sizeElement(element: HTMLElement, width: number | undefined, height: number | undefined): void {
  if (width !== undefined) element.style.width = `${width}px`;
  if (height !== undefined) element.style.height = `${height}px`;
}

// The app's own CSS (index.css, CSS modules) for an embedded instance. In the embed build it's one file next to the
// script (magid-embed.css); in dev, Vite injects <style data-vite-dev-id> into the page's <head>, which a shadow root
// doesn't see, so they're mirrored into it (with HMR updates). Returns a cleanup.
function addAppStyles(target: HTMLElement | ShadowRoot): () => void {
  if (import.meta.env.MODE === 'embed') {
    const href = new URL('./magid-embed.css', import.meta.url).href;
    if (target === document.head && document.head.querySelector(`link[href="${href}"]`)) return () => {};
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    target.appendChild(link);
    return () => link.remove();
  }
  if (!import.meta.env.DEV || target === document.head) return () => {};

  const copies = new Map<Element, HTMLStyleElement>();
  const mirror = () => {
    const sources = Array.from(document.head.querySelectorAll('style[data-vite-dev-id]'));
    for (const source of sources) {
      let copy = copies.get(source);
      if (!copy) {
        copy = document.createElement('style');
        copies.set(source, copy);
        target.appendChild(copy);
      }
      if (copy.textContent !== source.textContent) copy.textContent = source.textContent;
    }
    for (const [source, copy] of copies) {
      if (!sources.includes(source)) { copy.remove(); copies.delete(source); }
    }
  };
  mirror();
  const observer = new MutationObserver(mirror);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    copies.forEach((copy) => copy.remove());
  };
}
