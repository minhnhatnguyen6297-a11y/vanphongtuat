import { state, subscribe, patch } from './store.js';
import { startRouter } from './router.js';
import { connectWs, setChatSubs } from './ws.js';
import { apiMe } from './api.js';
import { renderHeader, bindHeader, renderTitle } from './ui/header.js';
import { renderLogin } from './ui/login.js';
import { renderRail } from './ui/rail.js';
import { renderHome, bindHome, titleHome } from './screens/home.js';
import { renderBan, bindBan, titleBan } from './screens/ban.js';
import { renderQuay, bindQuay, titleQuay } from './screens/quay.js';
import { renderTien, bindTien, titleTien, handleBillImage } from './screens/tien.js';
import { renderSo, bindSo, titleSo } from './screens/so.js';
import { renderKho, bindKho, titleKho, handleKhoImage, getKhoPasteTarget } from './screens/kho.js';
import { renderQuyen, bindQuyen, titleQuyen } from './screens/quyen.js';
import { renderSanh, bindSanh, titleSanh } from './screens/sanh.js';
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
    default:
      return titleBan();
  }
}

function renderShell(): void {
  if (!state.me) {
    void renderLogin(app!);
    return;
  }

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
    default:
      main = renderBan();
  }

  const route = state.route;
  const illustrated = route === 'ban' || route === 'quay' || route === 'tien';
  app!.innerHTML = `<div class="hn-scene${illustrated ? ' hn-scene-illustrated' : ''}" data-scene="${route}">
    ${illustrated ? `<div class="hn-scene-art" aria-hidden="true">
      <span class="hn-art-leaves"></span>
      ${route === 'tien' ? '<span class="hn-art-polaroid"></span>' : '<span class="hn-art-shiba"></span>'}
      ${route === 'ban' ? '<span class="hn-art-books"></span>' : ''}
    </div>` : ''}
    <div class="hn-shell${route === 'home' ? ' hn-shell-home' : ''}">
      ${renderHeader()}
      ${renderTitle(t.chip, t.fun)}
      ${main}
      ${route === 'home' ? '' : renderRail()}
    </div>
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
    default:
      bindBan(app!);
  }
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
