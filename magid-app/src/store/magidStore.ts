import { create } from 'zustand';
import { parseResponse, type ParsedElement } from '../lib/elementFactory';
import { injectStylesheet, clearInjectedStylesheets } from '../lib/cssUtils';
import {resolveAnchors, sendCommand as apiSendCommand} from '../api/magidClient';
import type { ConfigData } from '../types/protocol';

interface MagidState {
  baseUrl: string;
  connected: boolean;
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
  addCssFile: (name: string, content: string, baseUrl: string) => void;
  clearCssFiles: () => void;
  setVar: (name: string, value: string) => void;
  getVar: (name: string) => string | undefined;
  isVar: (name: string, expected: string) => boolean;
  commandRequiresCssReloading: (cmd: string) => boolean;
}

let cssFileSources: string[] = [];
async function fetchAndInjectCss(cssFileUrls: string, baseUrl: string, addCssFile: (n: string, c: string, b: string) => void) {
  const urls = cssFileUrls.split(';').map((u) => u.trim()).filter(Boolean);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[magid] Failed to fetch CSS: ${url} (${res.status})`);
        continue;
      }
      const text = await res.text();
      const name = url.split('/').pop() ?? url;
      addCssFile(name, text, baseUrl);
    } catch (e) {
      console.warn(`[magid] Failed to fetch CSS: ${url}`, e);
    }
  }
  void baseUrl;
}
function clearCssFiles(): void {
    cssFileSources = [];
}
function newCssFiles(cssFileNames: string): string {
    const urls = cssFileNames.split(';').map((u) => u.trim()).filter(Boolean);
    let result = "";
    for (const url of urls) {
        if ( !cssFileSources.includes(url)) {
            result += `;${url}`;
            cssFileSources.push(url);
        }
    }
    return result;
}
function applyConfig(data: ConfigData, get: () => MagidState) {
  const { addCssFile, setVar, baseUrl } = get();

  if (data['css-files'] ) {
    fetchAndInjectCss(newCssFiles(data['css-files']), baseUrl, addCssFile);
  }

  for (const [k, v] of Object.entries(data)) {
    if (k !== 'css-files' && v !== undefined) {
      setVar(k, v);
    }
  }
}

export const useMagidStore = create<MagidState>((set, get) => ({
  baseUrl: 'http://localhost:8090',
  connected: false,
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
      } else if (el.type === 'responses') {
        const inner: ParsedElement[] = [];
        for (const child of el.elements) {
          if (child.type === 'config') {
            applyConfig(child.data.config, get);
          } else {
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
    console.log('Sending a command: ' + cmd);
    console.log ('This command requires CSS reloading: ' + get().commandRequiresCssReloading(cmd))
    if  (get().commandRequiresCssReloading(cmd)) {
        get().clearCssFiles();
        clearCssFiles();
    }
    try {
      const raw = await apiSendCommand(baseUrl, cmd);
      loadResponse(raw);
      set({ connected: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      set({ error: msg, connected: false });
    } finally {
      set({ isLoading: false });
    }
  },

  addCssFile: (name, content, baseUrl) => {
      content = resolveAnchors(content, baseUrl)
    injectStylesheet(name, content);
    set((s) => ({ cssFileSources: { ...s.cssFileSources, [name]: content } }));
  },

  clearCssFiles: () => {
    clearInjectedStylesheets();
    set({ cssFileSources: {} });
  },

  setVar: (name, value) => {
    if (name === 'view-port' && value === 'maximized') {
      if (!get().getVar('viewport.ignoremaximization')) {
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
