// Mirrors the server's error code constants (see the server's error-code enum).
// This is the single source of truth for known code values — add newly
// introduced codes here only; nothing else should hardcode a code string.
export const ERROR_CODES = {
  // E01*: Server/file related
  TOO_MANY_SESSIONS: 'E01000',
  SESSION_NOT_FOUND: 'E01001',
  FILE_NOT_FOUND: 'E01002',
  FILE_CANNOT_BE_PARSED: 'E01003',

  // E02*: Repository related
  STORY_NOT_FOUND: 'E02001',

  // E09*: Client-related
  CLIENT_ID_NOT_PROVIDED: 'E09000',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Per current server behavior, any E01* (server/file related) error means the
// story/session cannot proceed — connectivity must stay blocked until the user
// explicitly resets the server, ends the session, or (re-)arms an XML. If this
// ever needs to become a per-code decision rather than per-prefix, this is the
// only place to change.
const CONNECTIVITY_BLOCKING_PREFIX = 'E01';

export function isConnectivityBlockingCode(code: string | undefined): boolean {
  return !!code && code.startsWith(CONNECTIVITY_BLOCKING_PREFIX);
}
