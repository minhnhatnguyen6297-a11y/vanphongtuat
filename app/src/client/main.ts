import { state, subscribe, patch } from './store.js';
import { startRouter } from './router.js';
import { connectWs, setChatSubs } from './ws.js';
import { apiMe } from './api.js';
import { renderHeader, bindHeader, renderTitle } from './ui/header.js';
import { renderLogin } from './ui/login.js';
import { renderHome, bindHome, titleHome } from './screens/home.js';
import { renderBan, bindBan, titleBan } from './screens/ban.js';
import { renderQuay, bindQuay, titleQuay } from './screens/quay.js';
import { renderTien, bindTien, titleTien, handleBillImage } from './screens/tien.js';
import { renderSo, bindSo, titleSo } from './screens/so.js';
import { renderKho, bindKho, titleKho, handleKhoImage, getKhoPasteTarget } from './screens/kho.js';
import { renderQuyen, bindQuyen, titleQuyen } from './screens/quyen.js';
import { renderSanh, bindSanh, titleSanh } from './screens/sanh.js';
import { renderChat, bindChat, titleChat } from './screens/chat.js';
import { bindPaste } from './image.js';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

let pasteUnbind: (() => void) | null = null;

function titles(): { chip: string; fun: string } {
  switch (state.route) {
    case 'home':
      return titleHome();
    case 'quay':
      return titleQuay();
    case 'tien':
      return titleTien();
    case 'so':
      return titleSo();
    case 'kho':
      return titleKho();
    case 'quyen':
      return titleQuyen();
    case 'sanh':
      return titleSanh();
    case 'chat':
      return titleChat();
    default:
      return titleBan();
  }
}

type FocusSnap =
  | { kind: 'chat'; scope: string; start: number | null; end: number | null }
  | { kind: 'id'; id: string; start: number | null; end: number | null }
  | null;

function captureFocus(): FocusSnap {
  const ae = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  if (!ae || !app?.contains(ae)) return null;
  const start = 'selectionStart' in ae ? ae.selectionStart : null;
  const end = 'selectionEnd' in ae ? ae.selectionEnd : null;
  if (ae.matches('[data-chat-input]')) {
    const scope = ae.closest('[data-chat-scope]')?.getAttribute('data-chat-scope');
    if (scope) return { kind: 'chat', scope, start, end };
  }
  if (ae.id) return { kind: 'id', id: ae.id, start, end };
  return null;
}

function restoreFocus(snap: FocusSnap): void {
  if (!snap || !app) return;
  let el: HTMLInputElement | HTMLTextAreaElement | null = null;
  if (snap.kind === 'chat') {
    el = app.querySelector(
      `[data-chat-scope="${CSS.escape(snap.scope)}"] [data-chat-input]`,
    ) as HTMLInputElement | null;
  } else {
    el = app.querySelector(`#${CSS.escape(snap.id)}`) as HTMLInputElement | null;
  }
  if (!el) return;
  el.focus({ preventScroll: true });
  if (snap.start != null && snap.end != null && 'setSelectionRange' in el) {
    try {
      el.setSelectionRange(snap.start, snap.end);
    } catch {
      /* number inputs etc. */
    }
  }
}

function renderShell(): void {
  if (!state.me) {
    void renderLogin(app!);
    return;
  }

  const focusSnap = captureFocus();

  const t = titles();
  let main = '';
  switch (state.route) {
    case 'home':
      main = renderHome();
      break;
    case 'quay':
      main = renderQuay();
      break;
    case 'tien':
      main = renderTien();
      break;
    case 'so':
      main = renderSo();
      break;
    case 'kho':
      main = renderKho();
      break;
    case 'quyen':
      main = renderQuyen();
      break;
    case 'sanh':
      main = renderSanh();
      break;
    case 'chat':
      main = renderChat();
      break;
    default:
      main = renderBan();
  }

  app!.innerHTML = `<div class="hn-shell${state.route === 'home' ? ' hn-shell-home' : ''}">
    ${renderHeader()}
    ${renderTitle(t.chip, t.fun)}
    ${main}
  </div>`;

  bindHeader(app!);
  switch (state.route) {
    case 'home':
      setChatSubs([]);
      bindHome(app!);
      break;
    case 'quay':
      bindQuay(app!);
      break;
    case 'tien':
      setChatSubs([]);
      bindTien(app!);
      break;
    case 'so':
      setChatSubs([]);
      bindSo(app!);
      break;
    case 'kho':
      setChatSubs([]);
      bindKho(app!);
      break;
    case 'quyen':
      setChatSubs([]);
      bindQuyen(app!);
      break;
    case 'sanh':
      bindSanh(app!);
      break;
    case 'chat':
      bindChat(app!);
      break;
    default:
      bindBan(app!);
  }

  restoreFocus(focusSnap);
}

function setupPaste(): void {
  pasteUnbind?.();
  pasteUnbind = bindPaste((img) => {
    if (!state.me) return;
    if (state.route === 'tien') void handleBillImage(img);
    else if (state.route === 'kho') {
      const kind = getKhoPasteTarget();
      void handleKhoImage(img, kind);
    }
  });
}

async function boot(): Promise<void> {
  startRouter();
  setupPaste();

  const me = await apiMe();
  if (me) {
    patch((s) => {
      s.me = me;
    });
    if (!state.mock) connectWs();
  }

  subscribe(renderShell);
  renderShell();
}

void boot();
