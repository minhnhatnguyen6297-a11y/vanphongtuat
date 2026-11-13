import { esc } from '../../shared/esc.js';
import { state, memberById, canPerm } from '../store.js';
import type { ChatMsg } from '../../shared/types.js';
import { cmd } from '../ws.js';
import { toast } from './toast.js';
import { ICONS } from '../icons.js';

const expandedChats = new Set<string>();

export function chatMessagesFor(scope: string): ChatMsg[] {
  return state.chatByScope[scope] || [];
}

export function renderChatPanel(scope: string, opts?: { title?: string; collapsible?: boolean }): string {
  const title = opts?.title || 'CHAT';
  const msgs = chatMessagesFor(scope);
  const canSend = canPerm('chat.send');
  const canMod = canPerm('chat.mod');
  const meId = state.me?.id;

  const rows = msgs
    .map((m) => {
      const who = memberById(m.memberId)?.displayName || '?';
      const mine = m.memberId === meId;
      const canDel =
        !m.deletedAt &&
        (canMod ||
          (mine && Date.now() - new Date(m.createdAt).getTime() <= 2 * 60 * 1000));
      const body = m.deletedAt
        ? '<span class="hn-chat-body is-deleted">đã xóa</span>'
        : `<span class="hn-chat-body">${esc(m.body)}</span>`;
      const t = new Date(m.createdAt);
      const when = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      return `<div class="hn-chat-row" data-mid="${esc(m.id)}">
        <span class="hn-chat-time">${when}</span>
        <b class="hn-chat-who">${esc(who)}</b>
        ${body}
        ${canDel ? `<button type="button" class="hn-chat-del" data-chat-del="${esc(m.id)}" aria-label="Xóa tin">×</button>` : ''}
      </div>`;
    })
    .join('');

  const content = `
    <div class="hn-chat-log" data-chat-log>
      ${rows || '<span class="hn-chat-empty">Chưa có tin</span>'}
    </div>
    <div class="hn-chat-compose">
      <input class="hn-input" data-chat-input aria-label="Tin nhắn" maxlength="500" placeholder="${canSend ? 'Nhắn…' : 'Không gửi được'}" ${canSend ? '' : 'disabled'}>
      <button type="button" class="hn-btn hn-btn-blue" data-chat-send ${canSend ? '' : 'disabled'}>GỬI</button>
    </div>`;

  if (opts?.collapsible) {
    return `<details class="hn-chat-fold" data-chat-scope="${esc(scope)}" ${expandedChats.has(scope) ? 'open' : ''}>
      <summary class="hn-chat-title">${ICONS.chat} ${esc(title)}${msgs.length ? ` <span>(${msgs.length})</span>` : ''}</summary>
      ${content}
    </details>`;
  }

  return `<section class="hn-panel hn-chat" data-chat-scope="${esc(scope)}" aria-label="${esc(title)}">
    <h3 class="hn-chat-title">${esc(title)}</h3>
    ${content}
  </section>`;
}

export function bindChatPanel(root: HTMLElement): void {
  root.querySelectorAll('[data-chat-scope]').forEach((panel) => {
    const scope = (panel as HTMLElement).dataset.chatScope!;
    const log = panel.querySelector('[data-chat-log]');
    if (panel instanceof HTMLDetailsElement) {
      panel.addEventListener('toggle', () => {
        if (!panel.isConnected) return;
        if (panel.open) {
          expandedChats.add(scope);
          if (log) log.scrollTop = log.scrollHeight;
        } else {
          expandedChats.delete(scope);
        }
      });
    }
    const input = panel.querySelector('[data-chat-input]') as HTMLInputElement | null;
    const send = async () => {
      if (!canPerm('chat.send') || !input) return;
      const body = input.value.trim();
      if (!body) return;
      const ack = await cmd('chat.send', { scope, body });
      if (!ack.ok) {
        toast(ack.error === 'rate_limited' ? 'Chậm thôi' : 'Gửi lỗi');
        return;
      }
      input.value = '';
    };
    panel.querySelector('[data-chat-send]')?.addEventListener('click', () => void send());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void send();
      }
    });
    panel.querySelectorAll('[data-chat-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.chatDel!;
        const ack = await cmd('chat.delete', { id });
        if (!ack.ok) toast('Không xóa được');
      });
    });
    if (log) log.scrollTop = log.scrollHeight;
  });
}
