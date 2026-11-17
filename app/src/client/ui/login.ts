import { esc } from '../../shared/esc.js';
import { state, patch } from '../store.js';
import { toast } from './toast.js';
import { apiLogin, apiRegister, fetchLoginRoster } from '../api.js';
import { connectWs } from '../ws.js';
import { setRoute } from '../router.js';

let selectedUsername = '';

export async function renderLogin(mount: HTMLElement): Promise<void> {
  const roster = await fetchLoginRoster();
  if (state.me) return;
  if (!roster.some((member) => member.username === selectedUsername)) {
    selectedUsername = roster[0]?.username ?? '';
  }

  const paint = () => {
    mount.innerHTML = `<div class="hn-login-wrap">
      <div class="hn-office-logo"><img src="/art/login-wordmark.png" alt="Văn phòng Tuất"></div>
      <form class="hn-login-card hn-paper-fold" aria-labelledby="login-title">
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
          <span class="hn-login-pin-box">
            <input class="hn-input" id="login-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" placeholder=" " ${roster.length ? '' : 'disabled'}>
            <span class="hn-login-pin-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </span>
        </label>
        <button type="submit" class="hn-btn hn-btn-red" id="login-go" ${roster.length ? '' : 'disabled'}>VÀO SẢNH</button>
      </form>
      <form class="hn-login-card hn-paper-fold" id="register-form" aria-labelledby="register-title">
        <h2 id="register-title">ĐĂNG KÝ</h2>
        <p class="hn-hint">Vào ngay, không cần duyệt. Tài khoản mới ở bậc thấp nhất.</p>
        <label>Tên đăng nhập
          <input class="hn-input" id="reg-user" autocomplete="username" maxlength="40" placeholder="ví dụ lan_moi">
        </label>
        <label>Tên hiển thị
          <input class="hn-input" id="reg-name" maxlength="80" placeholder="Tên mọi người thấy">
        </label>
        <label>PIN 6 số
          <input class="hn-input" id="reg-pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6">
        </label>
        <button type="submit" class="hn-btn hn-btn-green">TẠO TÀI KHOẢN</button>
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
    mount.querySelector('#register-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void doRegister();
    });
  };

  async function doRegister() {
    const username = (mount.querySelector<HTMLInputElement>('#reg-user')?.value || '').trim();
    const displayName = (mount.querySelector<HTMLInputElement>('#reg-name')?.value || '').trim();
    const pin = (mount.querySelector<HTMLInputElement>('#reg-pin')?.value || '').trim();
    if (!/^[a-z0-9_]{2,40}$/i.test(username)) {
      toast('Tên đăng nhập: chữ, số, gạch dưới');
      return;
    }
    if (!displayName) {
      toast('Điền tên hiển thị');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast('PIN 6 số nhé');
      return;
    }
    const res = await apiRegister(username, displayName, pin);
    if (!res.ok) {
      const msg =
        res.error === 'username_taken'
          ? 'Tên này đã có'
          : res.error === 'rate_limited'
            ? 'Thử lại sau ít phút'
            : 'Không tạo được';
      toast(msg);
      return;
    }
    if (!state.mock) connectWs();
    setRoute('home');
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
