const ATTR = 'data-magid-file';
const blobUrlMap = new Map<string, string>();

export async function injectStyleLink(url: string): Promise<void> {
  if (document.querySelector(`link[${ATTR}="${url}"]`)) return;

  const fetchUrl = url + '?cmd=resolveMagidProtocol';
  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      console.warn(`[magid] Failed to fetch CSS: ${url} (${res.status})`);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(ATTR, url);

    if ((res.headers.get('Content-Type') ?? '').includes('text/css')) {
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
