import { create } from 'zustand';
import { MagidClient, type MagidClientState } from '@magid/client-core';
import { syncStylesheets } from '../lib/cssUtils';
import { CLIENT_TYPE } from '../api/magidClient';
import { clientConfig } from '../config/clientConfig';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';

// React adapter over @magid/client-core's MagidClient: the protocol (session, scene/freshness recovery, config, detached
// elements, story loading) lives in the core. This store mirrors the client's state for components and adds what is
// React-UI only: toasts and the browser side effects (stylesheets, fullscreen).

export interface Toast {
  id: string;
  message: string;
}

interface MagidActions {
  setBaseUrl: (url: string) => void;
  sendCommand: (cmd: string) => Promise<void>;
  selectStory: (xmlPath: string) => Promise<boolean>;
  resetStory: () => Promise<boolean>;
  refreshXmlList: () => Promise<void>;
  setUserInput: (name: string, value: string) => void;
  endSession: () => Promise<void>;
  can: (capability: string) => boolean;
  addToast: (message: string) => void;
  dismissToast: (id: string) => void;
}

type MagidState = MagidClientState & { toasts: Toast[] } & MagidActions;

export const magidClient = new MagidClient({
  baseUrl: 'http://localhost:8090',
  clientType: CLIENT_TYPE,
  storage: { get: (key) => prefs.get(key) || null, set: (key, value) => prefs.set(key, value) },
  disabledCapabilities: clientConfig.showResetServerButton ? [] : ['reset-story'],
});

export const useMagidStore = create<MagidState>((set) => ({
  ...magidClient.getState(),
  toasts: [],

  setBaseUrl: (url) => magidClient.setBaseUrl(url),
  sendCommand: (cmd) => magidClient.send(cmd),
  selectStory: (xmlPath) => magidClient.selectStory(xmlPath),
  resetStory: () => magidClient.resetStory(),
  refreshXmlList: () => magidClient.refreshXmlList(),
  setUserInput: (name, value) => magidClient.setUserInput(name, value),
  endSession: () => magidClient.endSession(),
  can: (capability) => magidClient.can(capability),

  addToast: (message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

magidClient.subscribe((state) => {
  useMagidStore.setState(state);
  syncStylesheets(state.stylesheets, state.fileRequestToken ?? undefined, state.sessionId ?? undefined);
});

magidClient.on('notice', ({ message }) => useMagidStore.getState().addToast(message));

magidClient.on('viewport', ({ mode }) => {
  if (mode === 'maximized' && !prefs.getBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE)) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
});
