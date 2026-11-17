import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { state } from '../store.js';
import { setChatSubs } from '../ws.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';
import { renderTankFrame, bindTank } from '../be/mount.js';

export function titleChat(): { chip: string; fun: string } {
  const n = state.members.filter((m) => !m.disabled).length;
  return { chip: 'CHAT VP', fun: `PHÒNG CHAT · ${n} NGƯỜI` };
}

export function renderChat(): string {
  return `<main class="hn-main hn-chat-room">
    <p class="hn-hint hn-chat-room-hint">Chat tổng văn phòng — mọi người thấy chung. Ảnh cá chỉ vào bể, không gửi trong chat.</p>
    <div class="hn-chat-room-grid">
      ${renderTankFrame()}
      ${renderChatPanel(LOBBY_CHAT_SCOPE, { title: 'CHAT TỔNG', room: true })}
    </div>
  </main>`;
}

export function bindChat(root: HTMLElement): void {
  setChatSubs([LOBBY_CHAT_SCOPE]);
  bindChatPanel(root);
  bindTank(root);
}
