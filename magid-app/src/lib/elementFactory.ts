import { resolveAnchors } from '../api/magidClient';
import type {
  MenuResponse,
  NarrationResponse,
  CommandResponse,
  ConfigResponse,
  VisualResponse,
  SessionResponse,
} from '../types/protocol';

export type ParsedElement =
  | { type: 'menu'; data: MenuResponse }
  | { type: 'narration'; data: NarrationResponse }
  | { type: 'command'; data: CommandResponse }
  | { type: 'config'; data: ConfigResponse }
  | { type: 'visual'; data: VisualResponse }
  | { type: 'session'; data: SessionResponse }
  | { type: 'responses'; elements: ParsedElement[] };

type RawObject = Record<string, unknown>;

type ElementParser = (obj: RawObject, baseUrl: string) => ParsedElement;

// Single source of truth: maps JSON key → parser function.
// Multiple keys can map to the same ParsedElement type (aliases, per JFX ResponseNodeType).
// Add new element types here only.
const ELEMENT_PARSERS: Record<string, ElementParser> = {
  // Menu aliases: "menu" | "menu-name"  (server uses "menu-name")
  menu:            (obj) => ({ type: 'menu',      data: obj as unknown as MenuResponse }),
  'menu-name':     (obj) => ({ type: 'menu',      data: obj as unknown as MenuResponse }),
  // Narration aliases: "narration" | "text"
  narration:       (obj) => ({ type: 'narration', data: obj as unknown as NarrationResponse }),
  text:            (obj) => ({
    type: 'narration',
    data: { ...obj, narration: obj['text'] as string } as unknown as NarrationResponse,
  }),
  // Command aliases: "command" | "command-name" | "command-text"
  command:         (obj) => ({ type: 'command',   data: obj as unknown as CommandResponse }),
  'command-name':  (obj) => ({ type: 'command',   data: obj as unknown as CommandResponse }),
  'command-text':  (obj) => ({ type: 'command',   data: obj as unknown as CommandResponse }),
  // Config aliases: "config" | "configuration"
  config:          (obj) => ({ type: 'config',    data: obj as unknown as ConfigResponse }),
  configuration:   (obj) => ({ type: 'config',    data: obj as unknown as ConfigResponse }),
  // Visual (no aliases)
  visual:          (obj) => ({ type: 'visual',    data: obj as unknown as VisualResponse }),
  // command-reply: server emits this as the sole key for PRINT/PRINTLN/DEFAULT results
  'command-reply': (obj) => ({
    type: 'narration',
    data: { narration: obj['command-reply'] as string } as unknown as NarrationResponse,
  }),
  // menu-options: server always emits this key (even when no menu-name is buffered)
  'menu-options':  (obj) => ({ type: 'menu',      data: obj as unknown as MenuResponse }),
  // Session credentials sent on the initial empty command
  'session-id':    (obj) => ({ type: 'session',   data: obj as unknown as SessionResponse }),
};

function resolveStringsInObject(obj: unknown, baseUrl: string): unknown {
  if (typeof obj === 'string') return resolveAnchors(obj, baseUrl);
  if (Array.isArray(obj)) return obj.map((item) => resolveStringsInObject(item, baseUrl));
  if (obj !== null && typeof obj === 'object') {
    const result: RawObject = {};
    for (const [k, v] of Object.entries(obj as RawObject)) {
      result[k] = resolveStringsInObject(v, baseUrl);
    }
    return result;
  }
  return obj;
}

export function parseResponse(json: object, baseUrl: string): ParsedElement[] {
  const obj = resolveStringsInObject(json, baseUrl) as RawObject;

  if ('responses' in obj && Array.isArray(obj['responses'])) {
    const children: ParsedElement[] = (obj['responses'] as RawObject[]).flatMap(
      (item) => parseResponse(item, baseUrl)
    );
    return [{ type: 'responses', elements: children }];
  }

  // A single JSON object can contain multiple recognized keys (e.g. both "narration"
  // and "menu" in the same object). Collect all matches, mirroring the JFX client
  // which iterates every key and instantiates one element per recognized key.
  // Deduplicate by element type so alias keys (e.g. "menu" + "menu-name") on the
  // same object don't produce two elements of the same type.
  const elements: ParsedElement[] = [];
  const seenTypes = new Set<string>();
  for (const key of Object.keys(obj)) {
    const parser = ELEMENT_PARSERS[key];
    if (parser) {
      const el = parser(obj, baseUrl);
      if (!seenTypes.has(el.type)) {
        seenTypes.add(el.type);
        elements.push(el);
      }
    }
  }
  return elements;
}
``