// Web-platform globals the core relies on. Every target runtime (browsers, Node 18+, Deno, Bun) has them; declared
// here because tsconfig.json deliberately omits the DOM lib. Keep this list minimal: anything added must exist everywhere.
declare class URLSearchParams {
  set(name: string, value: string): void;
  get(name: string): string | null;
}

declare class URL {
  constructor(url: string, base?: string);
  readonly searchParams: URLSearchParams;
  toString(): string;
}

declare const console: {
  warn(...args: unknown[]): void;
  log(...args: unknown[]): void;
};
