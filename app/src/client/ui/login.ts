import { esc } from '../../shared/esc.js';
import { state, patch } from '../store.js';
import { toast } from './toast.js';
import { apiLogin, fetchLoginRoster } from '../api.js';
import { connectWs } from '../ws.js';
import { setRoute } from '../router.js';

let selectedUsername = '';

export async function renderLogin(mount: HTMLElement): Promise<void> {
  const roster = await fetchLoginRoster();
  if (!selectedUsername && roster[0]) selectedUsername = roster[0].username;

  const paint = () => {
    mount.innerHTML = `<div class="hn-login-wrap">
      <div class="hn-login-brand">
        <div class="hn-office-logo" aria-label="Văn phòng tuất">
          <span class="hn-office-logo-mark" aria-hidden="true">VP</span>
          <span class="hn-office-logo-stack">
            <span class="hn-office-logo-text">VĂN PHÒNG TUẤT</span>
            <span class="hn-office-logo-sub">Hôm nay ăn gì?</span>
          </span>
        </div>
      </div>
      <div class="hn-login-card">
        <h1>AI ĐÓ?</h1>
        <div class="hn-member-grid">
          ${roster
            .map(
              (m) =>
                `<button type="button" data-user="${esc(m.username)}" aria-pressed="${m.username === selectedUsername}">${esc(m.displayName)}</button>`,
            )
            .join('')}
        </div>
        <label style="display:flex;flex-direction:column;gap:4px;font-weight:800;margin-bottom:12px">
          PIN 6 số
          <input class="hn-input" id="login-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" pattern="[0-9]*" style="font-family:var(--font-mono);font-size:24px;letter-spacing:0.3em;text-align:center">
        </label>
        <button type="button" class="hn-btn hn-btn-red" id="login-go" style="width:100%;font-size:18px;min-height:52px">VÀO SẢNH</button>
      </div>
    </div>`;

    mount.querySelectorAll('[data-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedUsername = (btn as HTMLElement).dataset.user || '';
        paint();
        (mount.querySelector('#login-pin') as HTMLInputElement | null)?.focus();
      });
    });

    const pin = mount.querySelector('#login-pin') as HTMLInputElement;
    pin?.focus();
    pin?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void doLogin();
    });
    mount.querySelector('#login-go')?.addEventListener('click', () => void doLogin());
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
