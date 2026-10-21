// Thin React-app adapter over @magid/client-core's transport: keeps the old (baseUrl, …, authToken) signatures and
// announces this client as 'react'. Goes away once the store runs on the core client engine.
import * as core from '@magid/client-core';
import type { ServerStats, XmlEntry } from '@magid/client-core';

export { javaHashCode } from '@magid/client-core';

export const CLIENT_TYPE = 'react';

const config = (baseUrl: string, authToken?: string): core.TransportConfig => ({ baseUrl, authToken, clientType: CLIENT_TYPE });

export function sendCommand(baseUrl: string, cmd: string, extra?: Record<string, string>, authToken?: string): Promise<string> {
  return core.sendCommand(config(baseUrl, authToken), cmd, extra);
}

export function getXmlList(baseUrl: string, authToken?: string): Promise<XmlEntry[]> {
  return core.getXmlList(config(baseUrl, authToken));
}

export function requestXml(baseUrl: string, xmlPath: string, authToken?: string): Promise<string> {
  return core.requestXml(config(baseUrl, authToken), xmlPath);
}

export function fetchServerStats(baseUrl: string, authToken?: string): Promise<ServerStats> {
  return core.fetchServerStats(config(baseUrl, authToken));
}

export function endSession(baseUrl: string, authToken?: string): Promise<void> {
  return core.endSession(config(baseUrl, authToken));
}
