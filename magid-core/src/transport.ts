import { resolveAnchors, resolveInObject } from './anchors';
import type { ServerStats, ServerStatus, XmlEntry } from './protocol';

// The subset of WHATWG fetch the client needs; browsers, Node 18+ and Deno provide it as globalThis.fetch.
// Inject your own (tests, proxies, extra headers) via TransportConfig.fetch.
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}
export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponseLike>;

export interface TransportConfig {
  baseUrl: string;
  // Announced to the server as `client-type`; selects e.g. `<link client-type="…">` stylesheets. 'react', 'browser', …
  clientType: string;
  // Session id, sent as `Authorization: Bearer …`.
  authToken?: string;
  fetch?: FetchLike;
}

function resolveFetch(config: TransportConfig): FetchLike {
  const f = config.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) throw new Error('No fetch available: pass TransportConfig.fetch');
  return f;
}

export function buildCommandUrl(config: TransportConfig, cmd: string, extra?: Record<string, string>): string {
  const url = new URL(config.baseUrl);
  url.searchParams.set('cmd', cmd);
  url.searchParams.set('client-type', config.clientType);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

// GET {baseUrl}?cmd=…; returns the raw body with magid:// anchors resolved. Throws on HTTP errors and network failures;
// protocol-level errors (`status: 'error'` payloads) come back as normal bodies.
export async function sendCommand(config: TransportConfig, cmd: string, extra?: Record<string, string>): Promise<string> {
  const headers: Record<string, string> = {};
  if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
  const res = await resolveFetch(config)(
    buildCommandUrl(config, cmd, extra),
    Object.keys(headers).length ? { headers } : undefined,
  );
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  const text = await res.text();
  return resolveAnchors(text, config.baseUrl);
}

export async function getXmlList(config: TransportConfig): Promise<XmlEntry[]> {
  const raw = await sendCommand(config, 'list-xmls');
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed?.xmls ?? [];
  return list.map((item: unknown) => resolveInObject(item, config.baseUrl)) as XmlEntry[];
}

export async function serverStatus(config: TransportConfig): Promise<ServerStatus> {
  return JSON.parse(await sendCommand(config, 'server-status')) as ServerStatus;
}

export async function requestXml(config: TransportConfig, xmlPath: string): Promise<string> {
  return sendCommand(config, 'set-xml', { path: xmlPath });
}

export async function fetchServerStats(config: TransportConfig): Promise<ServerStats> {
  return JSON.parse(await sendCommand(config, 'server-stats')) as ServerStats;
}

export async function endSession(config: TransportConfig): Promise<void> {
  await sendCommand(config, 'end-session');
}

// Matches Java's String.hashCode() so a client can find its own session row (by uid-hash) in server stats.
export function javaHashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
