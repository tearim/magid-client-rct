const ATTR = 'data-magid-file';
const blobUrlMap = new Map<string, string>();

export async function injectStyleLink(url: string, fileRequestToken?: string, authToken?: string): Promise<void> {
  if (document.querySelector(`link[${ATTR}="${url}"]`)) return;

  const fetchUrlObj = new URL(url);
  fetchUrlObj.searchParams.set('cmd', 'resolve-magid-protocol');
  if (fileRequestToken) fetchUrlObj.searchParams.set('file-request-token', fileRequestToken);
  const fetchUrl = fetchUrlObj.toString();

  try {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(fetchUrl, Object.keys(headers).length ? { headers } : undefined);
    if (!res.ok) {
      console.warn(`[magid] Failed to fetch CSS: ${url} (${res.status})`);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(ATTR, url);

    // When an auth header is required, <link href> can't carry it — always use blob URL.
    if (!authToken && (res.headers.get('Content-Type') ?? '').includes('text/css')) {
      await res.body?.cancel();
      link.href = fetchUrl;
    } else {
      const text = await res.text();
      const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/css' }));
      blobUrlMap.set(url, blobUrl);
      link.href = blobUrl;
    }

    document.head.appendChild(link);
  } catch (e) {
    console.warn(`[magid] Failed to fetch CSS: ${url}`, e);
  }
}

export function clearInjectedStylesheets(): void {
  document.querySelectorAll(`link[${ATTR}]`).forEach((el) => el.remove());
  blobUrlMap.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
  blobUrlMap.clear();
}

// Brings the injected <link>s in line with the client's `stylesheets` state: new URLs are added; if any applied URL
// is gone (story reset/switch, session end), everything is cleared and re-applied.
let appliedStylesheets: string[] = [];

export function syncStylesheets(urls: string[], fileRequestToken?: string, authToken?: string): void {
  if (urls === appliedStylesheets) return;
  const keepsApplied = appliedStylesheets.every((u) => urls.includes(u));
  if (!keepsApplied) clearInjectedStylesheets();
  const alreadyApplied = keepsApplied ? appliedStylesheets : [];
  for (const url of urls) {
    if (!alreadyApplied.includes(url)) void injectStyleLink(url, fileRequestToken, authToken);
  }
  appliedStylesheets = urls;
}
