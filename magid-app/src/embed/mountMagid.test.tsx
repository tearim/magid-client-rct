import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { STORAGE_KEYS } from '@magiden/client-core';
import { mountMagid, type MagidHandle } from './mountMagid';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SERVER = 'http://stories.test';
const session = { 'session-id': 'sess-1', 'file-request-token': 'tok-1', 'server-name': 'Magid' };
const menu = { menu: 'inn', 'menu-description': 'You are at the inn.', 'menu-options': [{ 'command-name': 'go', 'command-description': 'Go' }] };

// Answers the session start with a session and a menu, and records the requests.
function fakeServer() {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({ responses: [session, menu] }), { status: 200 });
  }));
  return urls;
}

async function mount(element: HTMLElement, options: Parameters<typeof mountMagid>[1]): Promise<MagidHandle> {
  let handle!: MagidHandle;
  await act(async () => { handle = mountMagid(element, { baseUrl: SERVER, ...options }); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return handle;
}

describe('mountMagid', () => {
  let element: HTMLElement;
  let handle: MagidHandle | undefined;

  beforeEach(() => {
    localStorage.clear();
    element = document.createElement('section');
    document.body.appendChild(element);
  });

  afterEach(() => {
    act(() => handle?.unmount());
    handle = undefined;
    element.remove();
    vi.unstubAllGlobals();
  });

  it('renders an embedded story into a shadow root of the element, with no page chrome', async () => {
    fakeServer();
    handle = await mount(element, {});

    const shadow = element.shadowRoot;
    expect(shadow).not.toBeNull();
    expect(element.childNodes).toHaveLength(0);
    expect(shadow!.querySelector('.magid-app-root.magid-embedded')).not.toBeNull();
    expect(shadow!.textContent).toContain('You are at the inn.');
    expect(shadow!.querySelector('header')).toBeNull();
  });

  it('keeps an embedded instance’s storage under its prefix', async () => {
    fakeServer();
    handle = await mount(element, {});

    expect(localStorage.getItem(`magid.${STORAGE_KEYS.SESSION_ID}`)).toBe('sess-1');
    expect(localStorage.getItem(STORAGE_KEYS.SESSION_ID)).toBeNull();
  });

  it('loads the given story for a new session only', async () => {
    const urls = fakeServer();
    handle = await mount(element, { story: 'oasis/oasis.xml' });
    const commands = () => urls.map((u) => new URL(u).searchParams.get('cmd'));
    expect(commands()).toEqual(['', 'set-xml', '']);

    act(() => handle!.unmount());
    urls.length = 0;
    handle = await mount(element, { story: 'oasis/oasis.xml' });
    expect(commands()).toEqual(['']);
  });

  it('scopes to the element instead of a shadow root with isolation none', async () => {
    fakeServer();
    handle = await mount(element, { isolation: 'none' });

    expect(element.shadowRoot).toBeNull();
    expect(element.getAttribute('data-magid-mount')).not.toBeNull();
    expect(element.querySelector('.magid-app-root')?.textContent).toContain('You are at the inn.');
  });

  it('removes what it added when unmounted', async () => {
    fakeServer();
    handle = await mount(element, { isolation: 'none' });

    act(() => handle!.unmount());
    handle = undefined;

    expect(element.childNodes).toHaveLength(0);
    expect(element.hasAttribute('data-magid-mount')).toBe(false);
  });

  it('runs the full app with its chrome and unprefixed storage', async () => {
    fakeServer();
    handle = await mount(element, { mode: 'app' });

    expect(element.shadowRoot).toBeNull();
    expect(element.querySelector('header')).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.SESSION_ID)).toBe('sess-1');
  });
});
