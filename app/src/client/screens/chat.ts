import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { state } from '../store.js';
import { setChatSubs } from '../ws.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';

export function titleChat(): { chip: string; fun: string } {
  const n = state.members.filter((m) => !m.disabled).length;
  return { chip: 'CHAT VP', fun: `PHÒNG CHAT · ${n} NGƯỜI` };
}

export function renderChat(): string {
  return `<main class="hn-main hn-chat-room">
    <p class="hn-hint" style="margin:0 0 8px">Chat tổng văn phòng — mọi người thấy chung. Chat bàn / vòng / game vẫn riêng từng chỗ.</p>
    ${renderChatPanel(LOBBY_CHAT_SCOPE, { title: 'CHAT TỔNG' })}
  </main>`;
}

export function bindChat(root: HTMLElement): void {
  setChatSubs([LOBBY_CHAT_SCOPE]);
  bindChatPanel(root);
}
