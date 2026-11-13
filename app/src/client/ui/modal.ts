import { esc } from '../../shared/esc.js';

let openEl: HTMLElement | null = null;
let previousFocus: HTMLElement | null = null;

export function closeModal(): void {
  openEl?.remove();
  openEl = null;
  if (previousFocus?.isConnected && document.activeElement === document.body) previousFocus.focus();
  previousFocus = null;
}

export function openModal(opts: {
  title: string;
  bodyHtml: string;
  onMount?: (root: HTMLElement) => void;
}): HTMLElement {
  closeModal();
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const wrap = document.createElement('div');
  wrap.className = 'hn-modal-backdrop';
  wrap.innerHTML = `
    <div class="hn-modal" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <h2 style="margin:0;flex:1">${esc(opts.title)}</h2>
        <button type="button" class="hn-btn hn-btn-white" data-close aria-label="Đóng" style="min-width:44px">×</button>
      </div>
      <div data-body>${opts.bodyHtml}</div>
    </div>`;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeModal();
  });
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
  const closeButton = wrap.querySelector<HTMLButtonElement>('[data-close]')!;
  closeButton.addEventListener('click', () => closeModal());
  document.body.appendChild(wrap);
  openEl = wrap;
  closeButton.focus();
  opts.onMount?.(wrap.querySelector('[data-body]') as HTMLElement);
  return wrap;
}
