import { isCommandAllowed, parseAllowedCommands } from './capabilities';
import { parseResponse, type ParsedElement } from './elementFactory';
import { ERROR_CODES, isConnectivityBlockingCode } from './errorCodes';
import type { ConfigData, DetachedElementResponse, ServerErrorPayload, XmlEntry } from './protocol';
import { memoryStorage, STORAGE_KEYS, type KeyValueStorage } from './storage';
import * as transport from './transport';
import type { FetchLike, TransportConfig } from './transport';

export interface MagidClientState {
  baseUrl: string;
  // The last command reached the server.
  connected: boolean;
  // A server session exists (possibly restored from storage).
  serverConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectivityBlockedError: { code: string; message: string } | null;

  sessionId: string | null;
  fileRequestToken: string | null;
  xmlList: XmlEntry[];
  serverName: string | null;
  serverVersion: string | null;
  serverDescription: string | null;
  serverIcon: string | null;

  currentScene: string;
  menuClass: string;
  // What to render for the last response; config/session/detached elements are already consumed.
  elements: ParsedElement[];
  // Server vars from config elements (incl. freshness-key and implied-classes-of: …).
  envVars: Record<string, string>;
  userInputs: Record<string, string>;
  // Stylesheet URLs the current story asked for (css-files / css-files-react), in order. Loading them is the
  // renderer's job (DOM helpers), since it needs the fileRequestToken and a document.
  stylesheets: string[];
  // Server setting from config: `allowed-commands` (null until announced: everything allowed, see can()).
  allowedCommands: string[] | null;
}

export interface MagidClientEvents {
  // Something the user should be told (sync recovery, server error message, …). Renderers show it as a toast etc.
  notice: { message: string };
  // The story asked for a view-port mode (currently only 'maximized'); the renderer decides whether to go fullscreen.
  viewport: { mode: string };
}

export interface MagidClientOptions {
  baseUrl: string;
  // Announced to the server as `client-type`: 'react', 'browser', 'angular', …
  clientType: string;
  fetch?: FetchLike;
  // Session persistence; in-memory by default (no persistence across reloads).
  storage?: KeyValueStorage;
  // Commands (server actions) this deployment never offers, whatever the server allows: 'reload-xml' or
  // 'xml:reload-xml'.
  disabledCommands?: string[];
}

// Commands that load a story from scratch: the previous story's CSS, vars, scene and inputs are dropped first.
const STORY_LOADING_COMMANDS = ['reload-xml', 'set-xml'];

// Server setting in config: applied to state, not passed on as a story var. Kept across story loads.
const ALLOWED_COMMANDS = 'allowed-commands';

function parseServerError(raw: string): ServerErrorPayload | null {
  try {
    const json = JSON.parse(raw);
    if (json?.status === 'error') return json as ServerErrorPayload;
  } catch {
    // not JSON: not an error payload
  }
  return null;
}

function isStaleSessionError(error: ServerErrorPayload): boolean {
  if (error.code) return error.code === ERROR_CODES.SESSION_NOT_FOUND;
  return error.message === 'Client id/File request token was not found';
}

// Detached elements don't render standalone — they're spliced into whichever menu shares their response batch.
function collectDetached(elements: ParsedElement[], acc: DetachedElementResponse[]): void {
  for (const el of elements) {
    if (el.type === 'detached') acc.push(el.data);
    else if (el.type === 'responses') collectDetached(el.elements, acc);
  }
}

type Listener = (state: MagidClientState) => void;
type EventHandler<K extends keyof MagidClientEvents> = (event: MagidClientEvents[K]) => void;

export class MagidClient {
  private state: MagidClientState;
  private readonly listeners = new Set<Listener>();
  private readonly handlers = new Map<keyof MagidClientEvents, Set<(event: never) => void>>();
  private readonly clientType: string;
  private readonly fetchImpl?: FetchLike;
  private readonly storage: KeyValueStorage;
  private readonly disabledCommands: string[];
  // One command at a time: every command is chained onto the previous one.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: MagidClientOptions) {
    this.clientType = options.clientType;
    this.fetchImpl = options.fetch;
    this.storage = options.storage ?? memoryStorage();
    this.disabledCommands = options.disabledCommands ?? [];
    const sessionId = this.storage.get(STORAGE_KEYS.SESSION_ID) || null;
    this.state = {
      baseUrl: options.baseUrl,
      connected: false,
      serverConnected: !!sessionId,
      isLoading: false,
      error: null,
      connectivityBlockedError: null,
      sessionId,
      fileRequestToken: this.storage.get(STORAGE_KEYS.FILE_REQUEST_TOKEN) || null,
      xmlList: [],
      serverName: null,
      serverVersion: null,
      serverDescription: null,
      serverIcon: null,
      currentScene: '',
      menuClass: '',
      elements: [],
      envVars: {},
      userInputs: {},
      stylesheets: [],
      allowedCommands: null,
    };
  }

  // ---- observing -------------------------------------------------------------------------------------------------

  // Immutable snapshot; a new object after every change (works with useSyncExternalStore, zustand, signals, …).
  getState(): MagidClientState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  on<K extends keyof MagidClientEvents>(event: K, handler: EventHandler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler);
    return () => { set.delete(handler); };
  }

  private set(patch: Partial<MagidClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  private emit<K extends keyof MagidClientEvents>(event: K, payload: MagidClientEvents[K]): void {
    const set = this.handlers.get(event) as Set<EventHandler<K>> | undefined;
    set?.forEach((h) => h(payload));
  }

  // ---- capabilities ----------------------------------------------------------------------------------------------

  // Whether the UI should offer a command (e.g. 'reload-xml' for a reset button). Server actions need to be in the
  // server's `allowed-commands` (everything is allowed until it announces them); story commands always pass; the
  // operator's disabledCommands always win. Disabled commands are refused locally.
  can(command: string): boolean {
    return isCommandAllowed(command, this.state.allowedCommands, this.disabledCommands);
  }

  // ---- commands --------------------------------------------------------------------------------------------------

  // Sends a story command (button press, '' for "current menu"). Queued: resolves when this command has finished.
  send(cmd: string): Promise<void> {
    return this.enqueue(() => this.run(cmd)).then(() => undefined);
  }

  // Loads another story (set-xml). Resolves to false when the client refused it or the server rejected the XML.
  selectStory(xmlPath: string): Promise<boolean> {
    return this.enqueue(() => this.run('set-xml', { path: xmlPath }));
  }

  // Restarts the current story (reload-xml). Resolves to false when refused or rejected.
  resetStory(): Promise<boolean> {
    return this.enqueue(() => this.run('reload-xml'));
  }

  setUserInput(name: string, value: string): void {
    this.set({ userInputs: { ...this.state.userInputs, [name]: value } });
  }

  setBaseUrl(url: string): void {
    if (this.state.baseUrl === url) return;
    this.set({
      baseUrl: url,
      xmlList: [],
      serverConnected: false,
      serverName: null,
      serverVersion: null,
      serverDescription: null,
      serverIcon: null,
      allowedCommands: null,
    });
  }

  refreshXmlList(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.can('list-xmls')) return;
      try {
        const list = await transport.getXmlList(this.transportConfig(this.state.sessionId));
        if (list.length > 0) this.set({ xmlList: list });
      } catch {
        // silent — list stays as-is
      }
    });
  }

  endSession(): Promise<void> {
    return this.enqueue(async () => {
      try {
        if (this.can('end-session')) await transport.endSession(this.transportConfig(this.state.sessionId));
      } catch {
        // Session may already be gone on the server side; proceed with cleanup.
      }
      this.clearSession();
      this.set({
        connected: false,
        serverConnected: false,
        elements: [],
        menuClass: '',
        currentScene: '',
        envVars: {},
        userInputs: {},
        stylesheets: [],
        allowedCommands: null,
        connectivityBlockedError: null,
      });
    });
  }

  // Applies a raw server response. Returns false when it was an error payload or not JSON (nothing to render).
  loadResponse(raw: string): boolean {
    let json: object;
    try {
      json = JSON.parse(raw);
    } catch {
      this.set({ error: 'Server returned unexpected data' });
      return false;
    }

    if ((json as { status?: string }).status === 'error') {
      this.handleServerError(json as ServerErrorPayload);
      this.set({ elements: [] });
      return false;
    }

    const parsed = parseResponse(json, this.state.baseUrl);

    const detachedElements: DetachedElementResponse[] = [];
    collectDetached(parsed, detachedElements);

    // Pre-pass: apply session credentials before config so the file-request-token is available when CSS files from
    // the same response are loaded.
    for (const el of parsed) {
      this.applySession(el);
      if (el.type === 'responses') el.elements.forEach((child) => this.applySession(child));
    }

    let sawMenu = false;
    const consume = (el: ParsedElement): ParsedElement | null => {
      if (el.type === 'config') {
        this.applyConfig(el.data.config);
        return null;
      }
      if (el.type === 'session' || el.type === 'detached') return null;
      if (el.type === 'menu') {
        sawMenu = true;
        const name = el.data['menu-name'] ?? el.data.menu;
        if (name) this.set({ currentScene: name, menuClass: el.data['menu-class'] ?? '' });
        return { ...el, data: { ...el.data, 'detached-elements': detachedElements } };
      }
      return el;
    };

    const renderElements: ParsedElement[] = [];
    for (const el of parsed) {
      if (el.type === 'responses') {
        const inner = el.elements.map(consume).filter((e): e is ParsedElement => e !== null);
        renderElements.push({ type: 'responses', elements: inner });
      } else {
        const kept = consume(el);
        if (kept) renderElements.push(kept);
      }
    }

    // A new menu invalidates whatever the user typed into the previous one's inputs; seed fresh defaults from any
    // "input-value" on this batch's detached elements.
    if (sawMenu) {
      const initialInputs: Record<string, string> = {};
      for (const d of detachedElements) {
        if (d['element-type'] === 'input' && d['input-name'] && d['input-value'] !== undefined) {
          initialInputs[d['input-name']] = d['input-value'];
        }
      }
      this.set({ userInputs: initialInputs });
    }
    this.set({ elements: renderElements, error: null, connectivityBlockedError: null });
    return true;
  }

  // ---- internals -------------------------------------------------------------------------------------------------

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private transportConfig(authToken: string | null): TransportConfig {
    return { baseUrl: this.state.baseUrl, clientType: this.clientType, fetch: this.fetchImpl, authToken: authToken ?? undefined };
  }

  private request(cmd: string, extra: Record<string, string>, authToken: string | null): Promise<string> {
    return transport.sendCommand(this.transportConfig(authToken), cmd, extra);
  }

  private userInputExtra(): Record<string, string> {
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.state.userInputs)) extra[`user-input-${k}`] = v;
    return extra;
  }

  // Runs one command including the sync/session recovery protocol. Never throws; failures end up in state/notices.
  private async run(cmd: string, cmdExtra: Record<string, string> = {}): Promise<boolean> {
    if (!this.can(cmd)) {
      this.emit('notice', { message: `"${cmd}" is not available.` });
      return false;
    }

    this.set({ isLoading: true, error: null, elements: [] });

    if (STORY_LOADING_COMMANDS.includes(cmd)) {
      // A new story is loaded: its config (incl. freshness-key) arrives with the response.
      this.set({ stylesheets: [], currentScene: '', menuClass: '', envVars: {}, userInputs: {} });
    }

    const extra: Record<string, string> = { ...this.userInputExtra(), ...cmdExtra };
    const freshnessKey = this.state.envVars['freshness-key'];
    if (freshnessKey) extra['freshness-key'] = freshnessKey;
    const currentScene = this.state.currentScene;
    if (currentScene) extra['current-scene'] = currentScene;

    try {
      const authToken = this.state.sessionId;
      const raw = await this.request(cmd, extra, authToken);
      const serverError = parseServerError(raw);

      if (!serverError) {
        const ok = this.loadResponse(raw);
        this.set({ connected: true });
        return ok;
      }

      // Stale session: credentials rejected by the server — drop them and re-establish.
      if (isStaleSessionError(serverError)) {
        this.clearSession();
        const recoveryRaw = await this.request('', {}, null);
        if (!parseServerError(recoveryRaw)) {
          this.loadResponse(recoveryRaw);
          this.set({ connected: true });
        } else {
          this.emit('notice', { message: 'Session expired — could not re-establish connection.' });
        }
        return false;
      }

      // Fatal/blocking errors (e.g. a story file that can't be parsed) aren't recoverable by retrying.
      if (isConnectivityBlockingCode(serverError.code)) {
        this.handleServerError(serverError);
        this.set({ elements: [] });
        return false;
      }

      const correctedKey = serverError['freshness-key'];
      const correctedScene = serverError['current-scene'];
      const envVars = { ...this.state.envVars };
      if (correctedKey) envVars['freshness-key'] = correctedKey;

      // Scene mismatch: the client was on a different scene than the server. Dismiss the action and re-fetch the
      // current menu instead.
      if (correctedScene !== undefined && correctedScene !== currentScene) {
        this.set({ envVars, currentScene: correctedScene });
        this.emit('notice', { message: 'Your action was dismissed — the client was out of sync. The current menu has been restored.' });

        const recoveryExtra: Record<string, string> = {};
        if (correctedKey) recoveryExtra['freshness-key'] = correctedKey;
        if (correctedScene) recoveryExtra['current-scene'] = correctedScene;
        const recoveryRaw = await this.request('', recoveryExtra, authToken);
        if (!parseServerError(recoveryRaw)) {
          this.loadResponse(recoveryRaw);
          this.set({ connected: true });
        }
        return false;
      }

      // Freshness key mismatch: retry the same command once with the corrected key.
      this.set({ envVars, ...(correctedScene !== undefined && { currentScene: correctedScene }) });
      const retryExtra: Record<string, string> = { ...this.userInputExtra(), ...cmdExtra };
      if (correctedKey) retryExtra['freshness-key'] = correctedKey;
      if (correctedScene) retryExtra['current-scene'] = correctedScene;

      const retryRaw = await this.request(cmd, retryExtra, authToken);
      if (parseServerError(retryRaw)) {
        this.emit('notice', { message: 'Cannot synchronize with server — please try again or reconnect.' });
        return false;
      }
      const ok = this.loadResponse(retryRaw);
      this.set({ connected: true });
      return ok;
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : 'Connection failed', connected: false });
      return false;
    } finally {
      this.set({ isLoading: false });
    }
  }

  private handleServerError(error: ServerErrorPayload): void {
    if (error.message) this.emit('notice', { message: error.message });
    if (isConnectivityBlockingCode(error.code)) {
      this.set({ connectivityBlockedError: { code: error.code ?? 'UNKNOWN', message: error.message ?? 'The story cannot continue.' } });
    }
  }

  private applySession(el: ParsedElement): void {
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
    const patch: Partial<MagidClientState> = {};
    if (sessionId) {
      Object.assign(patch, { sessionId, serverConnected: true });
      this.storage.set(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    if (token) {
      patch.fileRequestToken = token;
      this.storage.set(STORAGE_KEYS.FILE_REQUEST_TOKEN, token);
    }
    if (xmls) patch.xmlList = Array.isArray(xmls) ? xmls : (xmls as Record<string, unknown>)?.['xmls'] as XmlEntry[] ?? [];
    if (serverName !== undefined) patch.serverName = serverName;
    if (serverVersion !== undefined) patch.serverVersion = serverVersion;
    if (serverDescription !== undefined) patch.serverDescription = serverDescription;
    if (serverIcon !== undefined) patch.serverIcon = serverIcon;
    this.set(patch);
  }

  private applyConfig(data: ConfigData): void {
    // A client-type specific list (css-files-react, css-files-browser, …) replaces the generic one.
    const cssFiles = data[`css-files-${this.clientType}`] ?? data['css-files'];
    if (cssFiles) {
      const urls = cssFiles.split(';').map((u) => u.trim()).filter(Boolean);
      const stylesheets = [...this.state.stylesheets];
      for (const url of urls) if (!stylesheets.includes(url)) stylesheets.push(url);
      this.set({ stylesheets });
    }

    if (data[ALLOWED_COMMANDS] !== undefined) {
      this.set({ allowedCommands: parseAllowedCommands(data[ALLOWED_COMMANDS]) });
    }

    const envVars = { ...this.state.envVars };
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('css-files') || v === undefined) continue;
      if (k === ALLOWED_COMMANDS) continue;
      if (k === 'view-port') this.emit('viewport', { mode: v });
      else if (k === 'menu-position') console.warn('[magid] menu-position is not implemented');
      envVars[k] = v;
    }
    this.set({ envVars });
  }

  private clearSession(): void {
    this.storage.set(STORAGE_KEYS.SESSION_ID, '');
    this.storage.set(STORAGE_KEYS.FILE_REQUEST_TOKEN, '');
    this.set({ sessionId: null, fileRequestToken: null });
  }
}
