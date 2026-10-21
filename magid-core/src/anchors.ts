export const MAGID_ANCHOR = 'magid://';

// Plain prefix replacement, exactly like the server's XmlBundleLoader: `magid:///path` → `{baseUrl}/path`.
export function resolveAnchors(text: string, baseUrl: string): string {
  return text.replaceAll(MAGID_ANCHOR, baseUrl);
}

export function resolveInObject(obj: unknown, baseUrl: string): unknown {
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
