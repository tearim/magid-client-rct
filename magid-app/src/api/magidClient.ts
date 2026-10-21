import { resolveAnchors, resolveInObject, type XmlEntry, type ServerStatus, type ServerStats } from '@magid/client-core';

// Matches Java's String.hashCode() so we can identify our session row by uid-hash.
export function javaHashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
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

export async function fetchServerStats(baseUrl: string, authToken?: string): Promise<ServerStats> {
  const raw = await sendCommand(baseUrl, 'server-stats', undefined, authToken);
  return JSON.parse(raw) as ServerStats;
}

export async function endSession(baseUrl: string, authToken?: string): Promise<void> {
  await sendCommand(baseUrl, 'end-session', undefined, authToken);
}
