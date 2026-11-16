import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { setChatSubs } from '../ws.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';
import { isBeKicked } from '../be/model.js';
import { ensureStage } from '../be/mount.js';

export function titleChat(): { chip: string; fun: string } {
  return { chip: 'BỂ CÁ', fun: 'DRAWQUARIUM VĂN PHÒNG' };
}

export function renderChat(): string {
  if (isBeKicked()) {
    return `<main class="hn-main">
      <div class="hn-be-kick" data-be-kick>
        <div>
          <svg class="hn-be-kick-fish" viewBox="0 0 120 64" aria-hidden="true">
            <ellipse cx="62" cy="34" rx="34" ry="18" fill="#F28C28" stroke="#1B1B1B" stroke-width="3"/>
            <path d="M30 34 L8 16 L14 34 L8 52 Z" fill="#C45A12" stroke="#1B1B1B" stroke-width="3"/>
            <circle cx="78" cy="28" r="5" fill="#fff" stroke="#1B1B1B" stroke-width="2"/>
            <circle cx="80" cy="28" r="2" fill="#1B1B1B"/>
          </svg>
          <h2>Bạn đã rời bể vì vắng lâu — tải lại trang để vào lại</h2>
          <button type="button" class="hn-btn hn-btn-red" data-be-reload>Vào lại</button>
        </div>
      </div>
    </main>`;
  }
  return `<main class="hn-main hn-be-room">
    <div class="hn-be-layout">
      <div id="be-slot"></div>
      <aside class="hn-be-chat" aria-label="Phòng chat">
        ${renderChatPanel(LOBBY_CHAT_SCOPE, { title: 'Phòng chat' })}
      </aside>
    </div>
  </main>`;
}

export function bindChat(root: HTMLElement): void {
  if (isBeKicked()) {
    root.querySelector('[data-be-reload]')?.addEventListener('click', () => location.reload());
    return;
  }
  setChatSubs([LOBBY_CHAT_SCOPE]);
  bindChatPanel(root);
  ensureStage(root);
}
