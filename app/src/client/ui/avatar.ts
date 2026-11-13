import { esc } from '../../shared/esc.js';
import { AVATAR_IDS, AVATAR_LABELS, type AvatarId } from '../../shared/avatars.js';
import { TIER_LABELS, type Tier } from '../../shared/perms-catalog.js';
import { state, patch, canOpenQuyen } from '../store.js';
import { openModal, closeModal } from './modal.js';
import { BANK_OPTIONS } from '../icons.js';
import { cmd, disconnectWs } from '../ws.js';
import { apiLogout } from '../api.js';
import { toast } from './toast.js';
import { setRoute } from '../router.js';
import { renderFace } from './face.js';

export function openAvatarModal(): void {
  const me = state.me;
  if (!me) return;
  const tier = (me.tier || (me.isOperator ? 'chu_xi' : 'dan_den')) as Tier;
  const showQuyen = canOpenQuyen();
  let pick: string | null = me.avatarId;

  const faceGrid = AVATAR_IDS.map((id) => {
    const on = pick === id;
    return `<button type="button" class="hn-face-pick" data-avatar="${id}" aria-pressed="${on}" aria-label="${esc(AVATAR_LABELS[id])}" title="${esc(AVATAR_LABELS[id])}">
      ${renderFace({ avatarId: id, displayName: AVATAR_LABELS[id], size: 48 })}
    </button>`;
  }).join('');

  openModal({
    title: me.displayName,
    bodyHtml: `
      <div style="margin-bottom:12px">
        <span style="display:inline-block;border:2px solid #1B1B1B;background:#FFCF33;padding:4px 10px;font-weight:800;box-shadow:3px 3px 0 #1B1B1B">${esc(TIER_LABELS[tier])}</span>
      </div>
      ${
        showQuyen
          ? `<div style="margin-bottom:14px">
               <button type="button" class="hn-btn hn-btn-red" id="av-quyen" style="width:100%">QUYỀN</button>
               <button type="button" class="hn-btn hn-btn-white" id="av-home" style="width:100%;margin-top:8px">← SẢNH</button>
             </div>`
          : `<div style="margin-bottom:14px">
               <button type="button" class="hn-btn hn-btn-white" id="av-home" style="width:100%">← SẢNH</button>
             </div>`
      }
      <b style="font-family:var(--font-display);font-size:14px">CHỌN MẶT</b>
      <div class="hn-face-grid" style="margin:8px 0 14px">${faceGrid}
        <button type="button" class="hn-face-pick" data-avatar="" aria-pressed="${!pick}" aria-label="Chữ cái" title="Chữ cái">
          ${renderFace({ avatarId: null, displayName: me.displayName, size: 48 })}
        </button>
      </div>
      <label style="display:flex;flex-direction:column;gap:4px;font-weight:800;margin-bottom:10px">Tên hiển thị
        <input class="hn-input" id="av-name" value="${esc(me.displayName)}" maxlength="120">
      </label>
      <div style="display:grid;gap:8px;margin-bottom:12px">
        <b style="font-family:var(--font-display);font-size:14px">ĐỔI PIN</b>
        <input class="hn-input" id="av-old-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN cũ" autocomplete="current-password">
        <input class="hn-input" id="av-new-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN mới" autocomplete="new-password">
      </div>
      <div style="display:grid;gap:8px;margin-bottom:12px">
        <b style="font-family:var(--font-display);font-size:14px">STK NHẬN TIỀN</b>
        <select class="hn-input" id="av-bin">
          <option value="">Chọn ngân hàng</option>
          ${BANK_OPTIONS.map(
            (b) =>
              `<option value="${b.bin}" ${me.bankBin === b.bin ? 'selected' : ''}>${esc(b.name)}</option>`,
          ).join('')}
        </select>
        <input class="hn-input" id="av-acc" value="${esc(me.bankAccount || '')}" placeholder="Số tài khoản" inputmode="numeric">
        <input class="hn-input" id="av-bank-name" value="${esc(me.bankNameDisplay || '')}" placeholder="Tên trên QR">
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button type="button" class="hn-btn" id="av-save">LƯU</button>
        <button type="button" class="hn-btn hn-btn-white" id="av-logout">Đăng xuất</button>
      </div>
      ${
        me.isOperator || me.tier === 'chu_xi'
          ? `<hr style="border:0;border-top:3px solid #1B1B1B;margin:16px 0">
             <b style="font-family:var(--font-display)">VẬN HÀNH</b>
             <ul style="margin:8px 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px">
               ${state.members
                 .map(
                   (m) =>
                     `<li style="display:flex;gap:8px;align-items:center;border:2px solid #1B1B1B;padding:6px 8px;background:#fff">
                       <span style="flex:1;font-weight:800">${esc(m.displayName)}</span>
                       <span style="font-family:var(--font-mono);font-size:12px">${esc(m.username)}</span>
                       ${m.disabled ? '<span style="color:#C62828;font-weight:800">KHÓA</span>' : ''}
                     </li>`,
                 )
                 .join('')}
             </ul>
             <p style="font-size:13px;color:#3D3D3D;margin:0">Thêm / reset PIN: dùng <code>npm run admin</code> trên máy chủ.</p>`
          : ''
      }
    `,
    onMount: (root) => {
      root.querySelector('#av-quyen')?.addEventListener('click', () => {
        closeModal();
        setRoute('quyen');
      });
      root.querySelector('#av-home')?.addEventListener('click', () => {
        closeModal();
        setRoute('home');
      });
      root.querySelectorAll('[data-avatar]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = (btn as HTMLElement).dataset.avatar || '';
          pick = v || null;
          root.querySelectorAll('[data-avatar]').forEach((b) => {
            const id = (b as HTMLElement).dataset.avatar || '';
            b.setAttribute('aria-pressed', String((id || null) === pick));
          });
        });
      });
      root.querySelector('#av-save')?.addEventListener('click', async () => {
        const displayName = (root.querySelector('#av-name') as HTMLInputElement).value.trim();
        const bankBin = (root.querySelector('#av-bin') as HTMLSelectElement).value || null;
        const bankAccount = (root.querySelector('#av-acc') as HTMLInputElement).value.trim() || null;
        const bankNameDisplay =
          (root.querySelector('#av-bank-name') as HTMLInputElement).value.trim() || null;
        await cmd('member.updateProfile', {
          displayName,
          avatarId: pick as AvatarId | null,
          bankBin,
          bankAccount,
          bankNameDisplay,
        });
        const oldPin = (root.querySelector('#av-old-pin') as HTMLInputElement).value;
        const newPin = (root.querySelector('#av-new-pin') as HTMLInputElement).value;
        if (oldPin || newPin) {
          if (!/^\d{6}$/.test(oldPin) || !/^\d{6}$/.test(newPin)) {
            toast('PIN phải 6 số');
            return;
          }
          const ack = await cmd('member.changePin', { oldPin, newPin });
          if (!ack.ok) {
            toast('Đổi PIN thất bại');
            return;
          }
        }
        toast('Đã lưu');
        closeModal();
      });
      root.querySelector('#av-logout')?.addEventListener('click', async () => {
        disconnectWs();
        await apiLogout();
        patch((s) => {
          s.me = null;
        });
        closeModal();
      });
    },
  });
}
