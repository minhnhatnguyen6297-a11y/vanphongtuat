import { state } from '../store.js';
import { renderTankFrame, bindTank } from '../be/mount.js';

export function titleChat(): { chip: string; fun: string } {
  const n = state.members.filter((m) => !m.disabled).length;
  return { chip: 'BỂ CÁ', fun: `AO CÁ · ${n} NGƯỜI` };
}

export function renderChat(): string {
  return `<main class="hn-main hn-chat-stage">
    ${renderTankFrame()}
  </main>`;
}

export function bindChat(root: HTMLElement): void {
  bindTank(root);
}
