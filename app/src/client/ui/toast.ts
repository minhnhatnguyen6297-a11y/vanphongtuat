let host: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.className = 'hn-toast-host';
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

export function toast(message: string, ms = 2800): void {
  const el = document.createElement('div');
  el.className = 'hn-toast';
  el.textContent = message;
  ensureHost().appendChild(el);
  setTimeout(() => {
    el.remove();
  }, ms);
}
