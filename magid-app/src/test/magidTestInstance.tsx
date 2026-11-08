import type { ReactNode } from 'react';
import { createMagidInstance, MagidContext, type MagidInstance } from '../store/magidStore';
import { resolveMountOptions, type MagidMountOptions } from '../embed/options';

// A Magid instance for component tests: an embedded-style host on a detached element, nothing sent to a server.
export function magidTestInstance(options: MagidMountOptions = {}): MagidInstance {
  const root = document.createElement('div');
  return createMagidInstance(resolveMountOptions(options), {
    root,
    keyTarget: root,
    fullscreenTarget: null,
    setWindowSize: () => {},
    overlayTarget: root,
    stylesheets: { container: document.head, scope: null },
  });
}

export function withMagid(instance: MagidInstance, children: ReactNode) {
  return <MagidContext.Provider value={instance}>{children}</MagidContext.Provider>;
}
