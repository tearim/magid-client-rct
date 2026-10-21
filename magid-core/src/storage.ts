// Where the client persists its session so it survives a reload. Browsers: wrap localStorage (see '@magid/client-core/dom'
// once it exists, or pass { get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) }).
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => { data.set(key, value); },
  };
}

// Same keys the React app has always used (PREF_KEYS), so persisted sessions survive the move to the core.
export const STORAGE_KEYS = {
  SESSION_ID: 'session.id',
  FILE_REQUEST_TOKEN: 'session.file-request-token',
} as const;
