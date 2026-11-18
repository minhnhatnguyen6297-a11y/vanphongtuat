import { esc } from '../../shared/esc.js';
import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { state, memberById, canPerm } from '../store.js';
import type { ChatMsg } from '../../shared/types.js';
import { cmd } from '../ws.js';
import { toast } from './toast.js';

const HOST_ID = 'hn-office-chat';
const DRAFT_KEY = 'vpt.office-chat.draft';

/** Mở/đóng sống trong module để đổi màn không dựng lại popup. */
let open = false;
let bound = false;

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(value: string): void {
  try {
    if (value) sessionStorage.setItem(DRAFT_KEY, value);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* tab chặn storage vẫn giữ nháp trên ô input */
  }
}

function messages(): ChatMsg[] {
  return state.chatByScope[LOBBY_CHAT_SCOPE] || [];
}

function logHtml(): string {
  const msgs = messages();
  const canMod = canPerm('chat.mod');
  const meId = state.me?.id;
  if (!msgs.length) return '<span class="hn-chat-empty">Chưa có tin</span>';
  return msgs
    .map((m) => {
      const who = memberById(m.memberId)?.displayName || '?';
      const mine = m.memberId === meId;
      const canDel =
        !m.deletedAt &&
        (canMod || (mine && Date.now() - new Date(m.createdAt).getTime() <= 2 * 60 * 1000));
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
}

function hostEl(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

function paintOpen(host: HTMLElement, focusInput: boolean): void {
  const btn = host.querySelector<HTMLButtonElement>('[data-office-chat-toggle]');
  const pop = host.querySelector<HTMLElement>('#hn-office-chat-pop');
  btn?.setAttribute('aria-expanded', String(open));
  document.querySelector('[data-fish-fab="chat"]')?.setAttribute('aria-expanded', String(open));
  if (pop) pop.hidden = !open;
  if (focusInput && open) {
    host.querySelector<HTMLInputElement>('[data-chat-input]')?.focus();
  }
}

function paintLog(host: HTMLElement): void {
  const log = host.querySelector<HTMLElement>('[data-chat-log]');
  if (!log) return;
  const html = logHtml();
  if (log.innerHTML === html) return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.innerHTML = html;
  log.querySelectorAll('[data-chat-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.chatDel;
      if (!id) return;
      const ack = await cmd('chat.delete', { id });
      if (!ack.ok) toast('Không xóa được');
    });
  });
  if (nearBottom) log.scrollTop = log.scrollHeight;
}

function paintSend(host: HTMLElement): void {
  const canSend = canPerm('chat.send');
  const input = host.querySelector<HTMLInputElement>('[data-chat-input]');
  const send = host.querySelector<HTMLButtonElement>('[data-chat-send]');
  if (input) {
    input.disabled = !canSend;
    input.placeholder = canSend ? 'Nhắn…' : 'Không gửi được';
  }
  if (send) send.disabled = !canSend;
}

async function sendDraft(host: HTMLElement): Promise<void> {
  if (!canPerm('chat.send')) return;
  const input = host.querySelector<HTMLInputElement>('[data-chat-input]');
  if (!input) return;
  const body = input.value.trim();
  if (!body) return;
  const ack = await cmd('chat.send', { scope: LOBBY_CHAT_SCOPE, body });
  if (!ack.ok) {
    toast(ack.error === 'rate_limited' ? 'Chậm thôi' : 'Gửi lỗi');
    return;
  }
  input.value = '';
  writeDraft('');
}

function bind(host: HTMLElement): void {
  const input = host.querySelector<HTMLInputElement>('[data-chat-input]');
  input?.addEventListener('input', () => writeDraft(input.value));
  host.querySelector('[data-office-chat-toggle]')?.addEventListener('click', () => {
    open = !open;
    paintOpen(host, true);
    if (open) {
      const log = host.querySelector<HTMLElement>('[data-chat-log]');
      if (log) log.scrollTop = log.scrollHeight;
    }
  });
  host.querySelector('[data-office-chat-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendDraft(host);
  });
}

/** Gắn popup vào node riêng, ngoài #app. Gọi lại mỗi lần vẽ màn: không dựng lại ô nháp. */
export function syncOfficeChat(): void {
  if (!state.me) {
    unmountOfficeChat();
    return;
  }
  const host = hostEl();
  host.hidden = false;
  if (!bound) {
    const draft = readDraft();
    host.innerHTML = `<button type="button" class="hn-office-chat-btn" data-office-chat-toggle aria-expanded="false" aria-controls="hn-office-chat-pop">Chat</button>
      <section id="hn-office-chat-pop" class="hn-office-chat-pop" data-chat-scope="${LOBBY_CHAT_SCOPE}" aria-label="Chat văn phòng" hidden>
        <div class="hn-chat-log" data-chat-log></div>
        <form class="hn-chat-compose" data-office-chat-form>
          <input class="hn-input" data-chat-input aria-label="Tin nhắn" maxlength="500" placeholder="Nhắn…" value="${esc(draft)}">
          <button type="submit" class="hn-btn hn-btn-blue" data-chat-send>GỬI</button>
        </form>
      </section>`;
    bind(host);
    bound = true;
  }
  const tankButton = document.querySelector<HTMLButtonElement>('[data-fish-fab="chat"]');
  host.toggleAttribute('data-tank', !!tankButton);
  if (tankButton) {
    tankButton.removeAttribute('aria-pressed');
    tankButton.setAttribute('aria-controls', 'hn-office-chat-pop');
    tankButton.onclick = () => host.querySelector<HTMLButtonElement>('[data-office-chat-toggle]')?.click();
  }
  paintOpen(host, false);
  paintSend(host);
  paintLog(host);
}

export function unmountOfficeChat(): void {
  const host = document.getElementById(HOST_ID);
  if (host) {
    host.replaceChildren();
    host.hidden = true;
  }
  bound = false;
  open = false;
}
