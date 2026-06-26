export interface MenuOption {
  'command-name': string;
  'command-description': string;
  'command-class'?: string;
}

export interface MenuResponse {
  menu?: string;
  'menu-name'?: string;
  'menu-description'?: string;
  'menu-options'?: MenuOption[];
  'menu-class'?: string;
  'menu-css'?: string;
  'menu-background-music'?: string;
}

export interface NarrationResponse {
  narration?: string;
  text?: string;
  class?: string;
  css?: string;
  defer?: string;
}

export interface CommandResponse {
  'command-name': string;
  'command-description': string;
  'command-class'?: string;
  'command-css'?: string;
  'command-defer'?: string;
}

export interface ConfigData {
  'css-files'?: string;
  'css-files-react'?: string;
  'freshness-key'?: string;
  'view-port'?: string;
  'menu-position'?: string;
  [key: string]: string | undefined;
}

export interface ConfigResponse {
  config: ConfigData;
}

export interface VisualResponse {
  visual: string;
  'transition-type'?: 'fade' | 'unfade';
  'transition-length'?: string;
  'transition-target'?: string;
  'transition-blocking'?: string;
}

export interface ResponsesWrapper {
  responses: ServerResponse[];
}

export type ServerResponse =
  | MenuResponse
  | NarrationResponse
  | CommandResponse
  | ConfigResponse
  | VisualResponse
  | ResponsesWrapper;

export interface XmlEntry {
  name: string;
  description: string;
  path: string;
  absolutePath: string;
}

export interface ServerStatus {
  xmlPath: string;
  [key: string]: string;
}

export interface ServerErrorPayload {
  status: 'error';
  'error-code'?: string;
  message?: string;
  'freshness-key'?: string;
  'current-scene'?: string;
}

export interface SessionResponse {
  'session-id': string;
  'file-request-token': string;
  'available-xmls'?: XmlEntry[];
  'server-name'?: string;
  'server-version'?: string;
  'server-description'?: string;
  'server-icon'?: string;
}

export interface ServerStatsHeader {
  'session-count': number;
  'session-max': number;
  'session-ttl': number;
  'session-short-ttl': number;
  'session-next-evict': number;
  'session-next-evict-explanation'?: string;
  [key: string]: unknown;
}

export interface ServerStatsSession {
  'is-admin': boolean;
  'uid-hash': number;
  'file-path': string;
  'is-short-lived': boolean;
  'command-count': number;
  'file-request-count': number;
  'last-active-time': number;
  'last-active-time-explanation'?: string;
  [key: string]: unknown;
}

export interface ServerStats {
  header: ServerStatsHeader;
  sessions: ServerStatsSession[];
}
