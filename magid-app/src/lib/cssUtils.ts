const ATTR = 'data-magid-file';

export function injectStylesheet(name: string, cssText: string): void {
  const existing = document.querySelector(`style[${ATTR}="${name}"]`);
  if (existing) existing.remove();
  const tag = document.createElement('style');
  tag.setAttribute(ATTR, name);
  //console.log(name);
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

export function clearInjectedStylesheets(): void {
  document.querySelectorAll(`style[${ATTR}]`).forEach((el) => el.remove());
}
