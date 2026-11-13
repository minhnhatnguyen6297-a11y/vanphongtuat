import { esc } from '../../shared/esc.js';
import { state, patch } from '../store.js';
import { toast } from './toast.js';
import { apiLogin, fetchLoginRoster } from '../api.js';
import { connectWs } from '../ws.js';
import { setRoute } from '../router.js';
import { ICONS } from '../icons.js';

let selectedUsername = '';

export async function renderLogin(mount: HTMLElement): Promise<void> {
  const roster = await fetchLoginRoster();
  if (state.me) return;
  if (!roster.some((member) => member.username === selectedUsername)) {
    selectedUsername = roster[0]?.username ?? '';
  }

  const paint = () => {
    mount.innerHTML = `<div class="hn-login-wrap">
      <div class="hn-office-logo"><span>VĂN PHÒNG</span><strong>TUẤT</strong>${ICONS.paw}</div>
      <form class="hn-login-card" aria-labelledby="login-title">
        <h1 id="login-title">ĐĂNG NHẬP</h1>
        <fieldset class="hn-login-roster">
          <legend>Chọn tên</legend>
          <div class="hn-member-grid">
          ${roster
            .map(
              (m) =>
                `<button type="button" data-user="${esc(m.username)}" aria-pressed="${m.username === selectedUsername}">${esc(m.displayName)}</button>`,
            )
            .join('') || '<p>Chưa có thành viên để đăng nhập.</p>'}
          </div>
        </fieldset>
        <label class="hn-login-pin">
          PIN 6 số
          <input class="hn-input" id="login-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" ${roster.length ? '' : 'disabled'}>
        </label>
        <button type="submit" class="hn-btn hn-btn-red" id="login-go" ${roster.length ? '' : 'disabled'}>VÀO SẢNH</button>
      </form>
    </div>`;

    const pin = mount.querySelector<HTMLInputElement>('#login-pin');
    const members = mount.querySelectorAll<HTMLButtonElement>('[data-user]');
    members.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedUsername = btn.dataset.user || '';
        members.forEach((member) => member.setAttribute('aria-pressed', String(member === btn)));
        pin?.focus();
      });
    });

    pin?.focus();
    mount.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void doLogin();
    });
  };

  async function doLogin() {
    const pinEl = mount.querySelector('#login-pin') as HTMLInputElement;
    const pin = (pinEl?.value || '').trim();
    if (!selectedUsername) {
      toast('Chọn tên đã');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast('PIN 6 số nhé');
      return;
    }
    const res = await apiLogin(selectedUsername, pin);
    if (!res.ok) {
      if (res.error === 'locked' && res.retryAfterMin != null) {
        toast(`Thử lại sau ${res.retryAfterMin} phút`);
      } else {
        toast('Sai PIN rồi');
      }
      return;
    }
    patch((s) => {
      s.me = res.me!;
    });
    if (!state.mock) connectWs();
    setRoute('home');
  }

  paint();
}
