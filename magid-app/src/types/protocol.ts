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
}
