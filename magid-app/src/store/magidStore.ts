import { create } from 'zustand';
import { parseResponse, type ParsedElement } from '../lib/elementFactory';
import { injectStyleLink, clearInjectedStylesheets } from '../lib/cssUtils';
import { sendCommand as apiSendCommand, endSession as apiEndSession, getXmlList as apiGetXmlList } from '../api/magidClient';
import type { ConfigData, ServerErrorPayload, XmlEntry } from '../types/protocol';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';

export interface Toast {
  id: string;
  message: string;
}

interface MagidState {
  baseUrl: string;
  connected: boolean;
  currentScene: string;
  menuClass: string;
  elements: ParsedElement[];
  envVars: Record<string, string>;
  cssFileSources: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  cssReloadingCommands: string[];
  toasts: Toast[];
  sessionId: string | null;
  fileRequestToken: string | null;
  xmlList: XmlEntry[];
  serverConnected: boolean;
  serverName: string | null;
  serverVersion: string | null;
  serverDescription: string | null;
  serverIcon: string | null;

  setBaseUrl: (url: string) => void;
  refreshXmlList: () => Promise<void>;
  setConnected: (v: boolean) => void;
  loadResponse: (raw: string) => void;
  sendCommand: (cmd: string) => Promise<void>;
  addCssFile: (url: string) => void;
  clearCssFiles: () => void;
  setVar: (name: string, value: string) => void;
  getVar: (name: string) => string | undefined;
  isVar: (name: string, expected: string) => boolean;
  commandRequiresCssReloading: (cmd: string) => boolean;
  addToast: (message: string) => void;
  dismissToast: (id: string) => void;
  endSession: () => Promise<void>;
}

function parseServerError(raw: string): ServerErrorPayload | null {
  try {
    const json = JSON.parse(raw);
    if (json?.status === 'error') return json as ServerErrorPayload;
  } catch {}
  return null;
}

// TODO: replace placeholder once the server defines the alphanumeric code for this error
const STALE_SESSION_ERROR_CODE = 'SESSION_NOT_FOUND';

function isStaleSessionError(error: ServerErrorPayload): boolean {
  if (error['error-code']) return error['error-code'] === STALE_SESSION_ERROR_CODE;
  return error.message === 'Client id/File request token was not found';
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
  menuClass: '',
  elements: [],
  envVars: {},
  cssFileSources: {},
  isLoading: false,
  error: null,
  toasts: [],
  sessionId: prefs.get(PREF_KEYS.SESSION_ID) || null,
  fileRequestToken: prefs.get(PREF_KEYS.FILE_REQUEST_TOKEN) || null,
  xmlList: [],
  serverConnected: !!prefs.get(PREF_KEYS.SESSION_ID),
  serverName: null,
  serverVersion: null,
  serverDescription: null,
  serverIcon: null,

  setBaseUrl: (url) => set({
    baseUrl: url,
    xmlList: [],
    serverConnected: false,
    serverName: null,
    serverVersion: null,
    serverDescription: null,
    serverIcon: null,
  }),
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

    // Pre-pass: apply session credentials before config so the file-request-token
    // is available when CSS files are loaded from the same response.
    const applySessionEl = (el: ParsedElement) => {
      if (el.type !== 'session') return;
      const {
        'session-id': sessionId,
        'file-request-token': token,
        'available-xmls': xmls,
        'server-name': serverName,
        'server-version': serverVersion,
        'server-description': serverDescription,
        'server-icon': serverIcon,
      } = el.data;
      if (sessionId) {
        set({ sessionId, serverConnected: true });
        prefs.set(PREF_KEYS.SESSION_ID, sessionId);
      }
      if (token) {
        set({ fileRequestToken: token });
        prefs.set(PREF_KEYS.FILE_REQUEST_TOKEN, token);
      }
      if (xmls) set({ xmlList: Array.isArray(xmls) ? xmls : (xmls as Record<string, unknown>)?.['xmls'] as XmlEntry[] ?? [] });
      if (serverName !== undefined) set({ serverName });
      if (serverVersion !== undefined) set({ serverVersion });
      if (serverDescription !== undefined) set({ serverDescription });
      if (serverIcon !== undefined) set({ serverIcon });
    };
    for (const el of parsed) {
      applySessionEl(el);
      if (el.type === 'responses') el.elements.forEach(applySessionEl);
    }

    const renderElements: ParsedElement[] = [];
    for (const el of parsed) {
      if (el.type === 'config') {
        applyConfig(el.data.config, get);
      } else if (el.type === 'session') {
        // already applied in the pre-pass above
      } else if (el.type === 'menu') {
        const name = el.data['menu-name'] ?? el.data.menu;
        if (name) set({ currentScene: name, menuClass: el.data['menu-class'] ?? '' });
        renderElements.push(el);
      } else if (el.type === 'responses') {
        const inner: ParsedElement[] = [];
        for (const child of el.elements) {
          if (child.type === 'config') {
            applyConfig(child.data.config, get);
          } else if (child.type === 'session') {
            // already applied in the pre-pass above
          } else {
            if (child.type === 'menu') {
              const name = child.data['menu-name'] ?? child.data.menu;
              if (name) set({ currentScene: name, menuClass: child.data['menu-class'] ?? '' });
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
    set({ isLoading: true, error: null, elements: [] });

    if (get().commandRequiresCssReloading(cmd)) {
      get().clearCssFiles();
      const envVars = { ...get().envVars };
      delete envVars['freshness-key'];
      set({ currentScene: '', menuClass: '', envVars });
    }

    const extra: Record<string, string> = {};
    const freshnessKey = get().getVar('freshness-key');
    if (freshnessKey) extra['freshness-key'] = freshnessKey;
    const currentScene = get().currentScene;
    if (currentScene) extra['current-scene'] = currentScene;

    try {
      const authToken = get().sessionId ?? undefined;
      const raw = await apiSendCommand(baseUrl, cmd, extra, authToken);
      const serverError = parseServerError(raw);

      if (serverError) {
        // Stale session: credentials rejected by server — drop them and re-establish.
        if (isStaleSessionError(serverError)) {
          set({ sessionId: null, fileRequestToken: null });
          prefs.set(PREF_KEYS.SESSION_ID, '');
          prefs.set(PREF_KEYS.FILE_REQUEST_TOKEN, '');
          const recoveryRaw = await apiSendCommand(baseUrl, '', {}, undefined);
          if (!parseServerError(recoveryRaw)) {
            loadResponse(recoveryRaw);
            set({ connected: true });
          } else {
            get().addToast('Session expired — could not re-establish connection.');
          }
          return;
        }

        const correctedKey = serverError['freshness-key'];
        const correctedScene = serverError['current-scene'];

        const newEnvVars = { ...get().envVars };
        if (correctedKey) newEnvVars['freshness-key'] = correctedKey;

        // Scene mismatch: the client was on a different scene than the server.
        // The action must be dismissed — re-fetch the current menu instead.
        if (correctedScene !== undefined && correctedScene !== currentScene) {
          set({ envVars: newEnvVars, currentScene: correctedScene });
          get().addToast('Your action was dismissed — the client was out of sync. The current menu has been restored.');

          const recoveryExtra: Record<string, string> = {};
          if (correctedKey) recoveryExtra['freshness-key'] = correctedKey;
          if (correctedScene) recoveryExtra['current-scene'] = correctedScene;

          const recoveryRaw = await apiSendCommand(baseUrl, '', recoveryExtra, authToken);
          if (!parseServerError(recoveryRaw)) {
            loadResponse(recoveryRaw);
            set({ connected: true });
          }
          return;
        }

        // Freshness key mismatch: retry the same command with the corrected key.
        set({
          envVars: newEnvVars,
          ...(correctedScene !== undefined && { currentScene: correctedScene }),
        });

        const retryExtra: Record<string, string> = {};
        if (correctedKey) retryExtra['freshness-key'] = correctedKey;
        if (correctedScene) retryExtra['current-scene'] = correctedScene;

        const retryRaw = await apiSendCommand(baseUrl, cmd, retryExtra, authToken);
        const retryError = parseServerError(retryRaw);

        if (retryError) {
          get().addToast('Cannot synchronize with server — please try again or reconnect.');
        } else {
          loadResponse(retryRaw);
          set({ connected: true });
        }
        return;
      }

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
    void injectStyleLink(url, get().fileRequestToken ?? undefined, get().sessionId ?? undefined);
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

  addToast: (message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  refreshXmlList: async () => {
    const { baseUrl, sessionId } = get();
    try {
      const list = await apiGetXmlList(baseUrl, sessionId ?? undefined);
      if (list.length > 0) set({ xmlList: list });
    } catch {
      // silent — list stays as-is
    }
  },

  endSession: async () => {
    const { baseUrl, sessionId } = get();
    try {
      await apiEndSession(baseUrl, sessionId ?? undefined);
    } catch {
      // Session may already be gone on the server side; proceed with cleanup.
    }
    get().clearCssFiles();
    prefs.set(PREF_KEYS.SESSION_ID, '');
    prefs.set(PREF_KEYS.FILE_REQUEST_TOKEN, '');
    set({
      sessionId: null,
      fileRequestToken: null,
      connected: false,
      serverConnected: false,
      elements: [],
      menuClass: '',
      currentScene: '',
      envVars: {},
    });
  },
}));
