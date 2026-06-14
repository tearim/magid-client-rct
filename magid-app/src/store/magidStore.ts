import { create } from 'zustand';
import { parseResponse, type ParsedElement } from '../lib/elementFactory';
import { injectStyleLink, clearInjectedStylesheets } from '../lib/cssUtils';
import { sendCommand as apiSendCommand } from '../api/magidClient';
import type { ConfigData } from '../types/protocol';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';

interface MagidState {
  baseUrl: string;
  connected: boolean;
  currentScene: string;
  elements: ParsedElement[];
  envVars: Record<string, string>;
  cssFileSources: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  cssReloadingCommands: string[];

  setBaseUrl: (url: string) => void;
  setConnected: (v: boolean) => void;
  loadResponse: (raw: string) => void;
  sendCommand: (cmd: string) => Promise<void>;
  addCssFile: (url: string) => void;
  clearCssFiles: () => void;
  setVar: (name: string, value: string) => void;
  getVar: (name: string) => string | undefined;
  isVar: (name: string, expected: string) => boolean;
  commandRequiresCssReloading: (cmd: string) => boolean;
}

function applyConfig(data: ConfigData, get: () => MagidState) {
  const { addCssFile, setVar } = get();

  const cssFiles = data['css-files-react'] ?? data['css-files'];
  if (cssFiles) {
    cssFiles.split(';').map((u) => u.trim()).filter(Boolean).forEach(addCssFile);
  }

  for (const [k, v] of Object.entries(data)) {
    if (k !== 'css-files' && k !== 'css-files-react' && v !== undefined) {
      setVar(k, v);
    }
  }
}

export const useMagidStore = create<MagidState>((set, get) => ({
  baseUrl: 'http://localhost:8090',
  connected: false,
  currentScene: '',
  elements: [],
  envVars: {},
  cssFileSources: {},
  isLoading: false,
  error: null,

  setBaseUrl: (url) => set({ baseUrl: url }),
  setConnected: (v) => set({ connected: v }),
  cssReloadingCommands: ['reload-xml', 'set-xml'],

  loadResponse: (raw: string) => {
    let json: object;
    try {
      json = JSON.parse(raw);
    } catch {
      set({ error: 'Server returned unexpected data' });
      return;
    }

    const { baseUrl } = get();
    const parsed = parseResponse(json, baseUrl);

    const renderElements: ParsedElement[] = [];
    for (const el of parsed) {
      if (el.type === 'config') {
        applyConfig(el.data.config, get);
      } else if (el.type === 'menu') {
        const name = el.data['menu-name'] ?? el.data.menu;
        if (name) set({ currentScene: name });
        renderElements.push(el);
      } else if (el.type === 'responses') {
        const inner: ParsedElement[] = [];
        for (const child of el.elements) {
          if (child.type === 'config') {
            applyConfig(child.data.config, get);
          } else {
            if (child.type === 'menu') {
              const name = child.data['menu-name'] ?? child.data.menu;
              if (name) set({ currentScene: name });
            }
            inner.push(child);
          }
        }
        renderElements.push({ type: 'responses', elements: inner });
      } else {
        renderElements.push(el);
      }
    }

    set({ elements: renderElements, error: null });
  },
  commandRequiresCssReloading: (cmd: string): boolean => {
    return get().cssReloadingCommands.includes(cmd);
  },
  sendCommand: async (cmd: string) => {
    const { baseUrl, loadResponse } = get();
    set({ isLoading: true, error: null });
    if (get().commandRequiresCssReloading(cmd)) {
      get().clearCssFiles();
      const envVars = { ...get().envVars };
      delete envVars['freshness-key'];
      set({ currentScene: '', envVars });
    }
    const extra: Record<string, string> = {};
    const freshnessKey = get().getVar('freshness-key');
    if (freshnessKey) extra['freshness-key'] = freshnessKey;
    const currentScene = get().currentScene;
    if (currentScene) extra['current-scene'] = currentScene;

    try {
      const raw = await apiSendCommand(baseUrl, cmd, extra);
      loadResponse(raw);
      set({ connected: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      set({ error: msg, connected: false });
    } finally {
      set({ isLoading: false });
    }
  },

  addCssFile: (url) => {
    void injectStyleLink(url);
    set((s) => ({ cssFileSources: { ...s.cssFileSources, [url]: url } }));
  },

  clearCssFiles: () => {
    clearInjectedStylesheets();
    set({ cssFileSources: {} });
  },

  setVar: (name, value) => {
    if (name === 'view-port' && value === 'maximized') {
      if (!prefs.getBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE)) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else if (name === 'menu-position') {
      console.warn('[magid] menu-position is not implemented');
    }
    set((s) => ({ envVars: { ...s.envVars, [name]: value } }));
  },

  getVar: (name) => get().envVars[name],

  isVar: (name, expected) => get().envVars[name] === expected,
}));
