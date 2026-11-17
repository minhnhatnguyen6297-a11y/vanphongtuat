import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { state } from '../store.js';
import { setChatSubs } from '../ws.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';
import { renderTankFrame, bindTank } from '../be/mount.js';

export function titleChat(): { chip: string; fun: string } {
  const n = state.members.filter((m) => !m.disabled).length;
  return { chip: 'CHAT VP', fun: `AO CÁ · ${n} NGƯỜI` };
}

export function renderChat(): string {
  return `<main class="hn-main hn-chat-stage">
    ${renderTankFrame()}
    ${renderChatPanel(LOBBY_CHAT_SCOPE, { title: 'CHAT', collapsible: true, dock: true })}
  </main>`;
}

export function bindChat(root: HTMLElement): void {
  setChatSubs([LOBBY_CHAT_SCOPE]);
  bindChatPanel(root);
  bindTank(root);
}
