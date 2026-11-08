import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MenuResponse } from '@magiden/client-core';
import { MenuScene } from './MenuScene';
import { PREF_KEYS } from '../prefs/prefHelper';
import { magidTestInstance, withMagid } from '../test/magidTestInstance';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const appended = { detached: 'append', 'element-type': 'input', 'input-name': 'name', 'input-label': 'Your name' };

function menu(description: string): MenuResponse {
  return {
    'menu-name': 'inn',
    'menu-description': description,
    'menu-options': [{ 'command-name': 'go', 'command-description': 'Go' }],
    'detached-elements': [appended],
  } as MenuResponse;
}

describe('MenuScene: append elements', () => {
  let container: HTMLDivElement;
  let root: Root;
  let magid: ReturnType<typeof magidTestInstance>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    magid = magidTestInstance();
  });

  afterEach(() => {
    act(() => root.unmount());
    magid.dispose();
    container.remove();
    vi.useRealTimers();
  });

  const input = () => container.querySelector('input');

  it('shows an append element once a description with DCSTP_ markers has been typed', () => {
    act(() => root.render(withMagid(magid, <MenuScene data={menu('You enter. DCSTP_300@ The fire is warm.')} />)));
    expect(input()).toBeNull(); // precondition: still typing

    act(() => { vi.advanceTimersByTime(1000); });

    expect(container.textContent).toContain('The fire is warm.');
    expect(input()).not.toBeNull();
  });

  it('shows an append element at once when text timelines are skipped', () => {
    magid.prefs.set(PREF_KEYS.NARRATION_IGNORE_TEXT_TL, 'true');
    act(() => root.render(withMagid(magid, <MenuScene data={menu('You enter. DCSTP_300@ The fire is warm.')} />)));

    expect(container.textContent).not.toContain('DCSTP_');
    expect(input()).not.toBeNull();
  });

  it('shows an append element at once for a description without markers', () => {
    act(() => root.render(withMagid(magid, <MenuScene data={menu('You enter.')} />)));
    expect(input()).not.toBeNull();
  });
});
