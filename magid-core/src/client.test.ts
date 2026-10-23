import { describe, it, expect } from 'vitest';
import { MagidClient, type MagidClientOptions } from './client';
import { memoryStorage, STORAGE_KEYS } from './storage';
import type { FetchLike } from './transport';

const BASE = 'http://localhost:8090';

interface Request { cmd: string; params: Record<string, string>; auth?: string }

// Fake server: answers requests with scripted bodies in order and records what the client sent.
function fakeServer(...bodies: (object | string | Error)[]) {
  const requests: Request[] = [];
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const params: Record<string, string> = {};
    for (const [k, v] of (u.searchParams as unknown as Iterable<[string, string]>)) params[k] = v;
    requests.push({ cmd: params.cmd, params, auth: init?.headers?.Authorization });
    const body = bodies.shift();
    if (body === undefined) throw new Error(`unexpected request: ${url}`);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
  return { fetch, requests };
}

function client(fetch: FetchLike, options: Partial<MagidClientOptions> = {}) {
  const c = new MagidClient({ baseUrl: BASE, clientType: 'browser', fetch, ...options });
  const notices: string[] = [];
  c.on('notice', (n) => notices.push(n.message));
  return { c, notices };
}

const session = { 'session-id': 'sess-1', 'file-request-token': 'tok-1', 'server-name': 'Magid' };
const menu = (name: string, extra: object = {}) => ({ menu: name, 'menu-description': `You are at ${name}.`, ...extra });
const config = (vars: Record<string, string>) => ({ config: vars });
const error = (payload: object) => ({ status: 'error', ...payload });

describe('MagidClient: responses', () => {
  it('applies session, config and menu from one batch and renders only the menu', async () => {
    const storage = memoryStorage();
    const { fetch } = fakeServer({
      responses: [session, config({ 'freshness-key': 'k1', 'css-files': 'magid:///a.css;magid:///b.css' }), menu('inn')],
    });
    const { c } = client(fetch, { storage });

    await c.send('');

    const s = c.getState();
    expect(s.sessionId).toBe('sess-1');
    expect(s.fileRequestToken).toBe('tok-1');
    expect(s.serverName).toBe('Magid');
    expect(storage.get(STORAGE_KEYS.SESSION_ID)).toBe('sess-1');
    expect(s.envVars['freshness-key']).toBe('k1');
    expect(s.stylesheets).toEqual([`${BASE}/a.css`, `${BASE}/b.css`]);
    expect(s.currentScene).toBe('inn');
    expect(s.connected).toBe(true);
    expect(s.isLoading).toBe(false);
    expect(s.elements).toHaveLength(1);
    const batch = s.elements[0];
    expect(batch.type === 'responses' && batch.elements.map((e) => e.type)).toEqual(['menu']);
  });

  it('prefers the css-files list for its own client type', async () => {
    const { fetch } = fakeServer(config({ 'css-files': 'magid:///generic.css', 'css-files-browser': 'magid:///browser.css' }));
    const { c } = client(fetch);
    await c.send('');
    expect(c.getState().stylesheets).toEqual([`${BASE}/browser.css`]);
    expect(c.getState().envVars).toEqual({});
  });

  it('staples detached elements onto the menu of the same batch and seeds input values', async () => {
    const input = { detached: 'append', 'element-type': 'input', 'input-name': 'name', 'input-value': 'Alia' };
    const { fetch } = fakeServer({ responses: [menu('gate'), input] });
    const { c } = client(fetch);

    await c.send('');

    const batch = c.getState().elements[0];
    expect(batch.type).toBe('responses');
    if (batch.type !== 'responses') return;
    expect(batch.elements).toHaveLength(1);
    const m = batch.elements[0];
    expect(m.type === 'menu' && m.data['detached-elements']).toEqual([input]);
    expect(c.getState().userInputs).toEqual({ name: 'Alia' });
  });

  it('emits a viewport event for the view-port var', async () => {
    const { fetch } = fakeServer(config({ 'view-port': 'maximized' }));
    const { c } = client(fetch);
    const modes: string[] = [];
    c.on('viewport', (v) => modes.push(v.mode));
    await c.send('');
    expect(modes).toEqual(['maximized']);
  });

  it('reports a non-JSON body as an error', async () => {
    const { fetch } = fakeServer('<html>');
    const { c } = client(fetch);
    await c.send('');
    expect(c.getState().error).toBe('Server returned unexpected data');
  });
});

describe('MagidClient: requests', () => {
  it('sends session, freshness key, current scene and user inputs with the next command', async () => {
    const { fetch, requests } = fakeServer(
      { responses: [session, config({ 'freshness-key': 'k1' }), menu('inn')] },
      menu('cellar'),
    );
    const { c } = client(fetch);
    await c.send('');
    c.setUserInput('name', 'Alia');

    await c.send('go-down');

    expect(requests[1]).toEqual({
      cmd: 'go-down',
      auth: 'Bearer sess-1',
      params: { cmd: 'go-down', 'client-type': 'browser', 'user-input-name': 'Alia', 'freshness-key': 'k1', 'current-scene': 'inn' },
    });
  });

  it('uses a session restored from storage', async () => {
    const storage = memoryStorage({ [STORAGE_KEYS.SESSION_ID]: 'old-sess' });
    const { fetch, requests } = fakeServer(menu('inn'));
    const { c } = client(fetch, { storage });
    expect(c.getState().serverConnected).toBe(true);
    await c.send('');
    expect(requests[0].auth).toBe('Bearer old-sess');
  });

  it('runs one command at a time', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const started: string[] = [];
    const fetch: FetchLike = async (url) => {
      const cmd = new URL(url).searchParams.get('cmd') ?? '';
      started.push(cmd);
      if (cmd === 'slow') await gate;
      return { ok: true, status: 200, text: async () => JSON.stringify(menu(cmd || 'start')) };
    };
    const { c } = client(fetch);

    const first = c.send('slow');
    const second = c.send('fast');
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual(['slow']);

    release();
    await Promise.all([first, second]);
    expect(started).toEqual(['slow', 'fast']);
  });

  it('records network failures and keeps processing later commands', async () => {
    const { fetch } = fakeServer(new Error('Failed to fetch'), menu('inn'));
    const { c } = client(fetch);

    await c.send('');
    expect(c.getState().error).toBe('Failed to fetch');
    expect(c.getState().connected).toBe(false);

    await c.send('');
    expect(c.getState().error).toBeNull();
    expect(c.getState().currentScene).toBe('inn');
  });
});

describe('MagidClient: story loading', () => {
  const loaded = { responses: [session, config({ 'freshness-key': 'k1', 'implied-classes-of: a': 'b', 'css-files': 'magid:///old.css' }), menu('inn')] };

  it('resetStory drops the previous story state before sending and sends no stale key or scene', async () => {
    const { fetch, requests } = fakeServer(loaded, { responses: [config({ 'freshness-key': 'k2' }), menu('start')] });
    const { c } = client(fetch);
    await c.send('');
    c.setUserInput('name', 'Alia');

    expect(await c.resetStory()).toBe(true);

    expect(requests[1].params).toEqual({ cmd: 'reload-xml', 'client-type': 'browser' });
    expect(c.getState().envVars).toEqual({ 'freshness-key': 'k2' });
    expect(c.getState().stylesheets).toEqual([]);
    expect(c.getState().currentScene).toBe('start');
  });

  it('selectStory sends the path and resets like resetStory', async () => {
    const { fetch, requests } = fakeServer(loaded, menu('oasis'));
    const { c } = client(fetch);
    await c.send('');

    expect(await c.selectStory('oasis.xml')).toBe(true);

    expect(requests[1].params).toEqual({ cmd: 'set-xml', 'client-type': 'browser', path: 'oasis.xml' });
    expect(c.getState().envVars).toEqual({});
    expect(c.getState().currentScene).toBe('oasis');
  });

  it('selectStory resolves false when the server rejects the XML', async () => {
    const { fetch } = fakeServer(error({ code: 'E01003', message: 'Cannot parse oasis.xml' }));
    const { c, notices } = client(fetch);
    expect(await c.selectStory('oasis.xml')).toBe(false);
    expect(notices).toEqual(['Cannot parse oasis.xml']);
    expect(c.getState().connectivityBlockedError).toEqual({ code: 'E01003', message: 'Cannot parse oasis.xml' });
  });
});

describe('MagidClient: recovery', () => {
  it('re-establishes a stale session without credentials', async () => {
    const storage = memoryStorage({ [STORAGE_KEYS.SESSION_ID]: 'dead', [STORAGE_KEYS.FILE_REQUEST_TOKEN]: 'dead-tok' });
    const { fetch, requests } = fakeServer(
      error({ code: 'E01001', message: 'Client id/File request token was not found' }),
      { responses: [{ ...session, 'session-id': 'fresh' }, menu('inn')] },
    );
    const { c } = client(fetch, { storage });

    await c.send('look');

    expect(requests.map((r) => [r.cmd, r.auth])).toEqual([['look', 'Bearer dead'], ['', undefined]]);
    expect(c.getState().sessionId).toBe('fresh');
    expect(storage.get(STORAGE_KEYS.SESSION_ID)).toBe('fresh');
    expect(c.getState().currentScene).toBe('inn');
  });

  it('tells the user when a stale session cannot be re-established', async () => {
    const { fetch } = fakeServer(error({ code: 'E01001' }), error({ code: 'E01000', message: 'Too many sessions' }));
    const { c, notices } = client(fetch, { storage: memoryStorage({ [STORAGE_KEYS.SESSION_ID]: 'dead' }) });
    await c.send('look');
    expect(c.getState().sessionId).toBeNull();
    expect(notices).toEqual(['Session expired — could not re-establish connection.']);
  });

  it('dismisses the action on a scene mismatch and restores the server scene', async () => {
    const { fetch, requests } = fakeServer(
      { responses: [session, config({ 'freshness-key': 'k1' }), menu('inn')] },
      error({ message: 'scene mismatch', 'freshness-key': 'k9', 'current-scene': 'cellar' }),
      menu('cellar'),
    );
    const { c, notices } = client(fetch);
    await c.send('');

    await c.send('drink');

    expect(requests[2].params).toEqual({ cmd: '', 'client-type': 'browser', 'freshness-key': 'k9', 'current-scene': 'cellar' });
    expect(requests).toHaveLength(3);
    expect(c.getState().currentScene).toBe('cellar');
    expect(c.getState().envVars['freshness-key']).toBe('k9');
    expect(notices).toEqual(['Your action was dismissed — the client was out of sync. The current menu has been restored.']);
  });

  it('retries the same command once with a corrected freshness key', async () => {
    const { fetch, requests } = fakeServer(
      { responses: [session, config({ 'freshness-key': 'k1' }), menu('inn')] },
      error({ message: 'stale key', 'freshness-key': 'k2', 'current-scene': 'inn' }),
      menu('inn', { 'menu-description': 'Cheers!' }),
    );
    const { c, notices } = client(fetch);
    await c.send('');
    c.setUserInput('toast', 'to Alia');

    await c.send('drink');

    expect(requests[2].params).toEqual({
      cmd: 'drink', 'client-type': 'browser', 'user-input-toast': 'to Alia', 'freshness-key': 'k2', 'current-scene': 'inn',
    });
    expect(c.getState().envVars['freshness-key']).toBe('k2');
    expect(notices).toEqual([]);
  });

  it('keeps command parameters when retrying with a corrected freshness key', async () => {
    const { fetch, requests } = fakeServer(error({ 'freshness-key': 'k2' }), menu('oasis'));
    const { c } = client(fetch);
    await c.selectStory('oasis.xml');
    expect(requests[1].params.path).toBe('oasis.xml');
  });

  it('gives up after one failed retry', async () => {
    const { fetch, requests } = fakeServer(error({ 'freshness-key': 'k2' }), error({ 'freshness-key': 'k3' }));
    const { c, notices } = client(fetch);
    await c.send('drink');
    expect(requests).toHaveLength(2);
    expect(notices).toEqual(['Cannot synchronize with server — please try again or reconnect.']);
  });
});

describe('MagidClient: capabilities', () => {
  const ALLOWED = 'core:server-status,end-session;xml:list-xmls,set-xml';

  it('allows everything until the server announces allowed-commands', () => {
    const { c } = client(fakeServer().fetch);
    expect(c.getState().allowedCommands).toBeNull();
    expect(c.can('reload-xml')).toBe(true);
    expect(c.can('set-xml')).toBe(true);
  });

  it('takes allowed-commands from config, not as a story var', async () => {
    const { fetch } = fakeServer({ responses: [session, config({ 'allowed-commands': ALLOWED }), menu('inn')] });
    const { c } = client(fetch);

    await c.send('');

    expect(c.can('set-xml')).toBe(true);
    expect(c.can('reload-xml')).toBe(false);
    expect(c.can('go-north')).toBe(true);
    expect(c.getState().envVars).not.toHaveProperty('allowed-commands');
  });

  it('refuses commands the server does not allow, without contacting it', async () => {
    const { fetch, requests } = fakeServer({ responses: [session, config({ 'allowed-commands': ALLOWED }), menu('inn')] });
    const { c, notices } = client(fetch);
    await c.send('');

    expect(await c.resetStory()).toBe(false);

    expect(requests).toHaveLength(1);
    expect(notices).toHaveLength(1);
  });

  it('keeps allowed-commands when another story is loaded', async () => {
    const { fetch } = fakeServer(
      { responses: [session, config({ 'allowed-commands': ALLOWED }), menu('inn')] },
      { status: 'The server was reloaded.' },
    );
    const { c } = client(fetch);
    await c.send('');

    await c.selectStory('other.xml');

    expect(c.can('reload-xml')).toBe(false);
  });

  it('refuses commands the operator disabled, without contacting the server', async () => {
    const { fetch, requests } = fakeServer();
    const { c, notices } = client(fetch, { disabledCommands: ['reload-xml'] });

    expect(c.can('reload-xml')).toBe(false);
    expect(await c.resetStory()).toBe(false);
    await c.send('xml:reload-xml');

    expect(requests).toHaveLength(0);
    expect(notices).toHaveLength(2);
  });

  it('does not ask the server for the XML list when list-xmls is not allowed', async () => {
    const { fetch, requests } = fakeServer({ responses: [session, config({ 'allowed-commands': 'xml:set-xml' }), menu('inn')] });
    const { c } = client(fetch);
    await c.send('');

    await c.refreshXmlList();

    expect(requests).toHaveLength(1);
  });
});

describe('MagidClient: HTML policy', () => {
  it('is null until the server announces allowed-tags', async () => {
    const { fetch } = fakeServer({ responses: [session, config({ 'freshness-key': 'k1' }), menu('inn')] });
    const { c } = client(fetch);
    await c.send('');
    expect(c.getState().htmlPolicy).toBeNull();
  });

  it('takes allowed-tags and allowed-tag-attributes from config, not as story vars', async () => {
    const { fetch } = fakeServer({
      responses: [session, config({ 'allowed-tags': 'b,i,img', 'allowed-tag-attributes': 'class,src' }), menu('inn')],
    });
    const { c } = client(fetch);

    await c.send('');

    expect(c.getState().htmlPolicy).toEqual({ tags: ['b', 'i', 'img'], attributes: ['class', 'src'] });
    expect(c.getState().envVars).toEqual({});
  });
});

describe('MagidClient: session end', () => {
  it('clears session, story state and storage', async () => {
    const storage = memoryStorage();
    const { fetch, requests } = fakeServer({ responses: [session, config({ 'freshness-key': 'k1' }), menu('inn')] }, {});
    const { c } = client(fetch, { storage });
    await c.send('');

    await c.endSession();

    expect(requests[1]).toMatchObject({ cmd: 'end-session', auth: 'Bearer sess-1' });
    const s = c.getState();
    expect([s.sessionId, s.serverConnected, s.currentScene, s.envVars, s.elements]).toEqual([null, false, '', {}, []]);
    expect(storage.get(STORAGE_KEYS.SESSION_ID)).toBe('');
  });
});

describe('MagidClient: observing', () => {
  it('notifies subscribers with a new snapshot on every change', async () => {
    const { fetch } = fakeServer(menu('inn'));
    const { c } = client(fetch);
    const snapshots: unknown[] = [];
    const unsubscribe = c.subscribe((s) => snapshots.push(s));
    const before = c.getState();

    await c.send('');
    unsubscribe();
    c.setUserInput('x', 'y');

    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots).not.toContain(before);
    expect(snapshots.at(-1)).not.toBe(c.getState());
  });
});
