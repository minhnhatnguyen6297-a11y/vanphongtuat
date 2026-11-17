import { esc } from '../../shared/esc.js';
import { canonicalUsername } from '../../shared/username.js';
import { state, notify } from '../store.js';
import { toast } from './toast.js';
import { apiLogin, apiRegister, fetchLoginRoster } from '../api.js';
import { connectWs } from '../ws.js';
import { setRoute } from '../router.js';
import { loginFailureMessage } from '../login-message.js';
import { rememberLoginHint } from '../login-hint.js';

export async function renderLogin(mount: HTMLElement): Promise<void> {
  const roster = await fetchLoginRoster();
  if (state.me) return;

  mount.innerHTML = `<div class="hn-login-wrap">
      <div class="hn-office-logo"><img src="/art/login-wordmark.png" alt="Văn phòng Tuất"></div>
      <form class="hn-login-card hn-paper-fold" aria-labelledby="login-title">
        <h1 id="login-title">ĐĂNG NHẬP</h1>
        <fieldset class="hn-login-roster">
          <legend>Chọn nhanh</legend>
          <div class="hn-member-grid">
          ${roster
            .map(
              (m) =>
                `<button type="button" data-user="${esc(m.username)}" aria-pressed="false">${esc(m.displayName)}</button>`,
            )
            .join('') || '<p>Chưa có thẻ. Gõ tên đăng nhập bên dưới.</p>'}
          </div>
        </fieldset>
        <label class="hn-login-user">Tên đăng nhập
          <input class="hn-input" id="login-user" name="username" autocomplete="username" maxlength="40" placeholder="Gõ tên hoặc bấm thẻ">
        </label>
        <label class="hn-login-pin">
          PIN 6 số
          <span class="hn-login-pin-box">
            <input class="hn-input" id="login-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" placeholder=" ">
            <span class="hn-login-pin-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </span>
        </label>
        <p id="login-error" class="hn-login-error" role="alert" hidden></p>
        <button type="submit" class="hn-btn hn-btn-red" id="login-go">VÀO SẢNH</button>
      </form>
      <form class="hn-login-card hn-paper-fold" id="register-form" aria-labelledby="register-title">
        <h2 id="register-title">ĐĂNG KÝ</h2>
        <p class="hn-hint">Tạo xong vào sảnh ngay. Lần sau đăng nhập bằng tên và PIN vừa tạo. Bậc thấp nhất.</p>
        <label>Tên đăng nhập
          <input class="hn-input" id="reg-user" autocomplete="username" maxlength="40" placeholder="ví dụ lan_moi">
        </label>
        <label>Tên hiển thị
          <input class="hn-input" id="reg-name" maxlength="80" placeholder="Tên mọi người thấy">
        </label>
        <label>PIN 6 số
          <input class="hn-input" id="reg-pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6">
        </label>
        <p id="register-error" class="hn-login-error" role="alert" hidden></p>
        <button type="submit" class="hn-btn hn-btn-green">TẠO TÀI KHOẢN</button>
      </form>
    </div>`;

  const userEl = mount.querySelector<HTMLInputElement>('#login-user');
  const pinEl = mount.querySelector<HTMLInputElement>('#login-pin');
  const members = mount.querySelectorAll<HTMLButtonElement>('[data-user]');

  const syncCards = () => {
    const key = canonicalUsername(userEl?.value || '');
    members.forEach((member) => {
      const pressed = key.length > 0 && canonicalUsername(member.dataset.user || '') === key;
      member.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
  };

  members.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (userEl) userEl.value = btn.dataset.user || '';
      syncCards();
      pinEl?.focus();
    });
  });
  userEl?.addEventListener('input', syncCards);

  const showLoginError = (message: string) => {
    const el = mount.querySelector<HTMLElement>('#login-error');
    if (el) {
      el.hidden = false;
      el.textContent = message;
    }
    toast(message);
  };

  const showRegisterError = (message: string) => {
    const el = mount.querySelector<HTMLElement>('#register-error');
    if (el) {
      el.hidden = false;
      el.textContent = message;
    }
    toast(message);
  };

  mount.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void doLogin();
  });
  mount.querySelector('#register-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void doRegister();
  });
  userEl?.focus();

  async function doRegister() {
    const username = (mount.querySelector<HTMLInputElement>('#reg-user')?.value || '').trim();
    const displayName = (mount.querySelector<HTMLInputElement>('#reg-name')?.value || '').trim();
    const pin = (mount.querySelector<HTMLInputElement>('#reg-pin')?.value || '').trim();
    if (!/^[a-z0-9_]{2,40}$/i.test(username)) {
      showRegisterError('Tên đăng nhập: chữ, số, gạch dưới.');
      return;
    }
    if (!displayName) {
      showRegisterError('Điền tên hiển thị.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      showRegisterError('PIN 6 số.');
      return;
    }
    const res = await apiRegister(username, displayName, pin);
    if (!res.ok || !res.me) {
      showRegisterError(registerFailure(res.error, res.retryAfterMin));
      return;
    }
    rememberLoginHint(res.me.username);
    notify();
    if (!state.mock) connectWs();
    setRoute('home');
  }

  async function doLogin() {
    const username = (userEl?.value || '').trim();
    const pin = (pinEl?.value || '').trim();
    if (!username) {
      showLoginError('Điền tên đăng nhập.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      showLoginError('PIN 6 số.');
      return;
    }
    const res = await apiLogin(username, pin);
    if (!res.ok) {
      showLoginError(loginFailureMessage(res.error, res.retryAfterMin));
      return;
    }
    if (!state.mock) connectWs();
    setRoute('home');
  }
}

function registerFailure(error?: string, retryAfterMin?: number): string {
  if (error === 'username_taken') return 'Tên này đã có.';
  if (error === 'bad_username') return 'Tên đăng nhập: chữ, số, gạch dưới.';
  if (error === 'bad_pin') return 'PIN 6 số.';
  if (error === 'bad_name') return 'Điền tên hiển thị.';
  return loginFailureMessage(error, retryAfterMin);
}
