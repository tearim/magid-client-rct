import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { MagidClient, type MagidClientState } from '@magiden/client-core';
import { createStylesheetSync, type StylesheetTarget } from '../lib/cssUtils';
import { CLIENT_TYPE } from '../api/magidClient';
import type { ClientConfig } from '../config/clientConfig';
import { DEFAULT_SERVER, type ResolvedMountOptions } from '../embed/options';
import { createPrefs, createUrlHistory, PREF_KEYS, type Prefs, type UrlHistory } from '../prefs/prefHelper';

// React adapter over @magiden/client-core's MagidClient: the protocol (session, scene/freshness recovery, config, detached
// elements, story loading) lives in the core. One MagidInstance per mount (embed/mountMagid.tsx): its store mirrors the
// client's state for components and adds what is React-UI only: toasts and the browser side effects (stylesheets,
// fullscreen), aimed at the instance's MagidHost instead of the page.

export interface Toast {
  id: string;
  message: string;
}

interface MagidActions {
  setBaseUrl: (url: string) => void;
  // A reply to the story (button, `update-symbol`, '' for the current menu); the core sends it as `cmd=story-reply`.
  sendCommand: (cmd: string) => Promise<void>;
  selectStory: (xmlPath: string) => Promise<boolean>;
  resetStory: () => Promise<boolean>;
  refreshXmlList: () => Promise<void>;
  setUserInput: (name: string, value: string) => void;
  endSession: () => Promise<void>;
  can: (command: string) => boolean;
  addToast: (message: string) => void;
  dismissToast: (id: string) => void;
}

export type MagidState = MagidClientState & { toasts: Toast[] } & MagidActions;

// Where an instance's page-level effects go. The full app aims them at the page; an embedded instance at its element.
export interface MagidHost {
  // The app's root element (inside the shadow root, if there is one).
  root: HTMLElement;
  // Keyboard shortcuts (Escape skips typing) listen here.
  keyTarget: Window | HTMLElement;
  // What a story's `viewport: maximized` makes fullscreen; null: nothing.
  fullscreenTarget: HTMLElement | null;
  // Applies -mg-window-width/-height (px): to the page in the full app, to the Magid area when embedded.
  setWindowSize: (width: number | undefined, height: number | undefined) => void;
  // Fades render into this element (embedded); null: fixed over the window.
  overlayTarget: HTMLElement | null;
  stylesheets: StylesheetTarget;
}

export interface MagidInstance {
  client: MagidClient;
  store: StoreApi<MagidState>;
  prefs: Prefs;
  urlHistory: UrlHistory;
  options: ResolvedMountOptions;
  host: MagidHost;
  dispose(): void;
}

export function createMagidInstance(options: ResolvedMountOptions, host: MagidHost): MagidInstance {
  const prefs = createPrefs(options.storagePrefix);
  const client = new MagidClient({
    baseUrl: options.baseUrl ?? DEFAULT_SERVER,
    clientType: CLIENT_TYPE,
    storage: { get: (key) => prefs.get(key) || null, set: (key, value) => prefs.set(key, value) },
    disabledCommands: options.clientConfig.showResetServerButton ? [] : ['reload-xml'],
  });

  const store = createStore<MagidState>((set) => ({
    ...client.getState(),
    toasts: [],

    setBaseUrl: (url) => client.setBaseUrl(url),
    sendCommand: (cmd) => client.send(cmd),
    selectStory: (xmlPath) => client.selectStory(xmlPath),
    resetStory: () => client.resetStory(),
    refreshXmlList: () => client.refreshXmlList(),
    setUserInput: (name, value) => client.setUserInput(name, value),
    endSession: () => client.endSession(),
    can: (command) => client.can(command),

    addToast: (message) => {
      const id = crypto.randomUUID();
      set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    },

    dismissToast: (id) => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  }));

  const stylesheets = createStylesheetSync(host.stylesheets);
  const unsubscribers = [
    client.subscribe((state) => {
      store.setState(state);
      stylesheets.sync(state.stylesheets, state.fileRequestToken ?? undefined, state.sessionId ?? undefined);
    }),
    client.on('notice', ({ message }) => store.getState().addToast(message)),
    client.on('viewport', ({ mode }) => {
      if (mode === 'maximized' && host.fullscreenTarget && !prefs.getBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE)) {
        host.fullscreenTarget.requestFullscreen?.().catch(() => {});
      }
    }),
  ];

  return {
    client,
    store,
    prefs,
    urlHistory: createUrlHistory(prefs),
    options,
    host,
    dispose() {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      stylesheets.clear();
    },
  };
}

export const MagidContext = createContext<MagidInstance | null>(null);

export function useMagidInstance(): MagidInstance {
  const instance = useContext(MagidContext);
  if (!instance) throw new Error('Magid components need a MagidContext (mount them with mountMagid)');
  return instance;
}

const wholeState = (s: MagidState) => s;

export function useMagidStore(): MagidState;
export function useMagidStore<T>(selector: (s: MagidState) => T): T;
export function useMagidStore<T>(selector?: (s: MagidState) => T): T | MagidState {
  return useStore(useMagidInstance().store, (selector ?? wholeState) as (s: MagidState) => T | MagidState);
}

// For reading the state outside rendering (event handlers, effects): useMagidStoreApi().getState().
export function useMagidStoreApi(): StoreApi<MagidState> {
  return useMagidInstance().store;
}

export function usePrefs(): Prefs {
  return useMagidInstance().prefs;
}

export function useUrlHistory(): UrlHistory {
  return useMagidInstance().urlHistory;
}

export function useMountOptions(): ResolvedMountOptions {
  return useMagidInstance().options;
}

export function useClientConfig(): ClientConfig {
  return useMagidInstance().options.clientConfig;
}

export function useMagidHost(): MagidHost {
  return useMagidInstance().host;
}
