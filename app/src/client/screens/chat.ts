import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { state } from '../store.js';
import { setChatSubs } from '../ws.js';
import { bindBeRoom, destroyBeRoom, renderBeRoom, syncBeRoom } from '../be/room.js';

export function titleChat(): { chip: string; fun: string } {
  const n = state.members.filter((m) => !m.disabled).length;
  return { chip: 'BỂ CÁ', fun: `DRAWQUARIUM · ${n} NGƯỜI` };
}

export function renderChat(): string {
  return renderBeRoom();
}

export function bindChat(root: HTMLElement): void {
  setChatSubs([LOBBY_CHAT_SCOPE]);
  bindBeRoom(root);
}

export function syncChatRoom(root: HTMLElement): void {
  syncBeRoom(root);
}

export function destroyChatRoom(): void {
  destroyBeRoom();
}
