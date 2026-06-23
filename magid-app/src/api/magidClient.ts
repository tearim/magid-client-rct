import type { XmlEntry, ServerStatus } from '../types/protocol';

export const MAGID_ANCHOR = 'magid://';

export function resolveAnchors(text: string, baseUrl: string): string {
  //const base = baseUrl; //baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return text.replaceAll(MAGID_ANCHOR, baseUrl);
}

function resolveInObject(obj: unknown, baseUrl: string): unknown {
  if (typeof obj === 'string') return resolveAnchors(obj, baseUrl);
  if (Array.isArray(obj)) return obj.map((item) => resolveInObject(item, baseUrl));
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = resolveInObject(v, baseUrl);
    }
    return result;
  }
  return obj;
}

export async function sendCommand(
  baseUrl: string,
  cmd: string,
  extra?: Record<string, string>,
  authToken?: string
): Promise<string> {
  const url = new URL(baseUrl);
  url.searchParams.set('cmd', cmd);
  url.searchParams.set('client-type', 'react');
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      url.searchParams.set(k, v);
    }
  }
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(url.toString(), Object.keys(headers).length ? { headers } : undefined);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  const text = await res.text();
  return resolveAnchors(text, baseUrl);
}

export async function getXmlList(baseUrl: string, authToken?: string): Promise<XmlEntry[]> {
  const raw = await sendCommand(baseUrl, 'list-xmls', undefined, authToken);
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed?.xmls ?? [];
  return list.map((item: unknown) => resolveInObject(item, baseUrl)) as XmlEntry[];
}

export async function serverStatus(baseUrl: string, authToken?: string): Promise<ServerStatus> {
  const raw = await sendCommand(baseUrl, 'server-status', undefined, authToken);
  return JSON.parse(raw) as ServerStatus;
}

export async function requestXml(baseUrl: string, xmlPath: string, authToken?: string): Promise<string> {
  return sendCommand(baseUrl, 'set-xml', { path: xmlPath }, authToken);
}
