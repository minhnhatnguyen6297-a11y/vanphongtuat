import { esc } from '../../shared/esc.js';
import {
  PERM_KEYS,
  PERM_LABELS,
  TIERS,
  TIER_LABELS,
  isNoGrantPerm,
  type PermKey,
  type Tier,
} from '../../shared/perms-catalog.js';
import { state, canPerm, memberById, patch } from '../store.js';
import { cmd } from '../ws.js';
import { toast } from '../ui/toast.js';

type Tab = 'matrix' | 'members' | 'requests';

let tab: Tab = 'matrix';

export function titleQuyen(): { chip: string; fun: string } {
  return { chip: 'QUYỀN', fun: 'AI ĐƯỢC LÀM GÌ?' };
}

function setTab(t: Tab) {
  tab = t;
  patch(() => undefined);
}

function matrixHas(tier: Tier, key: PermKey): boolean {
  return (state.perms.matrix[tier] || []).includes(key);
}

function renderMatrix(): string {
  const manage = canPerm('perm.manage');
  const editable = PERM_KEYS.filter((k) => !isNoGrantPerm(k));
  return `<div class="hn-matrix-wrap">
    <table class="hn-matrix">
      <thead>
        <tr>
          <th>QUYỀN</th>
          ${TIERS.map((t) => `<th>${esc(TIER_LABELS[t])}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${editable
          .map(
            (key) => `<tr>
              <td style="font-weight:800">${esc(PERM_LABELS[key])}</td>
              ${TIERS.map((tier) => {
                const on = matrixHas(tier, key);
                if (!manage) {
                  return `<td class="is-center">${on ? '✓' : '—'}</td>`;
                }
                return `<td class="is-center" style="padding:4px">
                  <button type="button" class="hn-btn hn-btn-white" data-mx="${tier}|${key}" aria-pressed="${on}"
                    style="min-height:32px;min-width:42px;font-size:14px;padding:4px 8px;background:${on ? 'var(--green)' : '#fff'};color:${on ? '#fff' : 'var(--ink)'}">${on ? 'ON' : 'OFF'}</button>
                </td>`;
              }).join('')}
            </tr>`,
          )
          .join('')}
        ${PERM_KEYS.filter((k) => isNoGrantPerm(k))
          .map(
            (key) => `<tr class="is-fixed">
              <td style="font-weight:800">${esc(PERM_LABELS[key])} <span style="font-size:11px;color:var(--red)">(cố định)</span></td>
              ${TIERS.map((tier) => {
                const on = matrixHas(tier, key);
                return `<td class="is-center">${on ? '✓' : '—'}</td>`;
              }).join('')}
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>
  <p class="hn-hint">Luôn ≥1 tầng có Chốt quán và Nhập bill. Không leo thang manage/approve/admin.</p>`;
}

function renderMembers(): string {
  const manage = canPerm('perm.manage');
  const admin = canPerm('member.admin');
  const addForm = admin
    ? `<div class="hn-perm-box" style="margin-bottom:12px">
        <span class="hn-perm-box-head">THÊM TÀI KHOẢN</span>
        <div class="hn-row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <input class="hn-input" id="adm-user" placeholder="username" autocomplete="off" style="flex:1;min-width:120px;min-height:44px">
          <input class="hn-input" id="adm-name" placeholder="Tên hiển thị" autocomplete="off" style="flex:1;min-width:140px;min-height:44px">
          <button type="button" class="hn-btn" data-adm-add style="min-height:44px">THÊM</button>
        </div>
        <p class="hn-hint" style="margin:8px 0 0">PIN 6 số tạo ngẫu nhiên — hiện một lần sau khi thêm / reset.</p>
      </div>`
    : '';
  return `<div class="hn-stack-tight">
    ${addForm}
    ${state.members
      .map((m) => {
        const tier = (m.tier || 'dan_den') as Tier;
        const adminBtns = admin
          ? `<span style="display:inline-flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="hn-btn hn-btn-white" data-adm-reset="${m.id}" style="min-height:36px;font-size:12px">Reset PIN</button>
              <button type="button" class="hn-btn ${m.disabled ? '' : 'hn-btn-white'}" data-adm-disable="${m.id}" data-disabled="${m.disabled ? '1' : '0'}" style="min-height:36px;font-size:12px;${m.disabled ? 'background:var(--green);color:#fff' : ''}">${m.disabled ? 'Mở khóa' : 'Khóa'}</button>
            </span>`
          : '';
        return `<div class="hn-member-row">
          <div style="flex:1;min-width:0">
            <b style="font-weight:800">${esc(m.displayName)}</b>
            <div class="hn-member-meta">${esc(m.username)}${m.disabled ? ' · KHÓA' : ''}</div>
          </div>
          ${
            manage
              ? `<select class="hn-input" data-tier="${m.id}" style="max-width:200px">
                  ${TIERS.map(
                    (t) =>
                      `<option value="${t}" ${t === tier ? 'selected' : ''}>${esc(TIER_LABELS[t])}</option>`,
                  ).join('')}
                </select>`
              : `<span class="hn-kind-tag">${esc(TIER_LABELS[tier])}</span>`
          }
          ${adminBtns}
        </div>`;
      })
      .join('')}
  </div>`;
}

function requestableKeys(): PermKey[] {
  return PERM_KEYS.filter((k) => !isNoGrantPerm(k) && !canPerm(k));
}

function renderRequests(): string {
  const approve = canPerm('perm.approve');
  const mine = state.perms.requests.filter((r) => r.memberId === state.me?.id);
  const pending = state.perms.requests;
  const keys = requestableKeys();

  return `<div class="hn-stack">
    <div class="hn-perm-box">
      <span class="hn-perm-box-head">XIN PHÉP (24h)</span>
      <div class="hn-perm-actions">
        ${
          keys.length
            ? keys
                .map(
                  (k) =>
                    `<button type="button" class="hn-btn hn-btn-white" data-req="${k}" style="font-size:12px">${esc(PERM_LABELS[k])}</button>`,
                )
                .join('')
            : '<span style="font-size:13px">Bạn đã có đủ quyền cơ bản.</span>'
        }
      </div>
      ${
        mine.length
          ? `<ul style="margin:12px 0 0;padding:0;list-style:none;font-size:13px;display:flex;flex-direction:column;gap:6px">${mine
              .map(
                (r) =>
                  `<li>· Đang chờ: <b>${esc(PERM_LABELS[r.permKey as PermKey] || r.permKey)}</b></li>`,
              )
              .join('')}</ul>`
          : ''
      }
    </div>
    ${
      approve
        ? `<div class="hn-perm-box is-cream">
            <span class="hn-perm-box-head">DUYỆT</span>
            <div class="hn-stack-tight" style="margin-top:12px">
              ${
                pending.length
                  ? pending
                      .map((r) => {
                        const who = memberById(r.memberId)?.displayName || r.memberId;
                        return `<div class="hn-row" style="border:2px solid var(--ink);background:#fff;padding:8px 10px;gap:8px">
                          <span style="flex:1;font-weight:800;min-width:0">${esc(who)} · ${esc(PERM_LABELS[r.permKey as PermKey] || r.permKey)}</span>
                          <button type="button" class="hn-btn" data-approve="${r.id}" style="min-height:36px">OK</button>
                          <button type="button" class="hn-btn hn-btn-white" data-deny="${r.id}" style="min-height:36px">Từ chối</button>
                        </div>`;
                      })
                      .join('')
                  : '<span style="font-size:13px">Không có yêu cầu.</span>'
              }
            </div>
          </div>`
        : ''
    }
  </div>`;
}

export function renderQuyen(): string {
  const manage = canPerm('perm.manage');
  const admin = canPerm('member.admin');
  // Member thường chỉ tab Xin phép; matrix cần perm.manage; members khi manage hoặc admin
  if (!manage && tab === 'matrix') tab = admin ? 'members' : 'requests';
  if (!manage && !admin && tab === 'members') tab = 'requests';

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'matrix', label: 'Ma trận', show: manage },
    { id: 'members', label: 'Thành viên', show: manage || admin },
    { id: 'requests', label: 'Xin phép', show: true },
  ];

  return `<main class="hn-main">
    <div class="hn-tabs">
      ${tabs
        .filter((t) => t.show)
        .map(
          (t) =>
            `<button type="button" class="hn-btn ${tab === t.id ? '' : 'hn-btn-white'}" data-tab="${t.id}">${t.label}</button>`,
        )
        .join('')}
    </div>
    ${tab === 'matrix' ? renderMatrix() : tab === 'members' ? renderMembers() : renderRequests()}
  </main>`;
}

export function bindQuyen(root: HTMLElement): void {
  root.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setTab((btn as HTMLElement).dataset.tab as Tab));
  });

  root.querySelectorAll('[data-mx]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const raw = (btn as HTMLElement).dataset.mx || '';
      const [tier, permKey] = raw.split('|') as [Tier, PermKey];
      const allowed = (btn as HTMLElement).getAttribute('aria-pressed') !== 'true';
      const ack = await cmd('perm.setMatrix', {
        entries: [{ tier, permKey, allowed }],
      });
      if (!ack.ok) {
        toast(ack.error === 'matrix_invariant' ? 'Không tắt hết Chốt/Bill' : 'Không đổi được');
        return;
      }
      toast('Đã cập nhật');
    });
  });

  root.querySelectorAll('[data-tier]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const memberId = (sel as HTMLElement).dataset.tier!;
      const tier = (sel as HTMLSelectElement).value as Tier;
      const ack = await cmd('perm.setTier', { memberId, tier });
      if (!ack.ok) {
        toast(
          ack.error === 'last_chu_xi'
            ? 'Còn ít nhất 1 Chủ xị'
            : ack.error === 'forbidden'
              ? 'Không đủ quyền'
              : 'Lỗi gán tầng',
        );
        return;
      }
      toast('Đã gán tầng');
    });
  });

  root.querySelectorAll('[data-req]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const permKey = (btn as HTMLElement).dataset.req!;
      const ack = await cmd('perm.request', { permKey });
      if (!ack.ok) {
        toast(ack.error === 'already_pending' ? 'Đang chờ duyệt' : 'Không xin được');
        return;
      }
      toast('Đã gửi xin phép');
    });
  });

  root.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ack = await cmd('perm.approve', { requestId: (btn as HTMLElement).dataset.approve });
      toast(ack.ok ? 'Đã duyệt (24h)' : 'Duyệt thất bại');
    });
  });

  root.querySelectorAll('[data-deny]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ack = await cmd('perm.deny', { requestId: (btn as HTMLElement).dataset.deny });
      toast(ack.ok ? 'Đã từ chối' : 'Lỗi');
    });
  });

  root.querySelector('[data-adm-add]')?.addEventListener('click', async () => {
    const username = (root.querySelector('#adm-user') as HTMLInputElement | null)?.value.trim() || '';
    const displayName = (root.querySelector('#adm-name') as HTMLInputElement | null)?.value.trim() || '';
    if (!username || !displayName) {
      toast('Nhập username và tên');
      return;
    }
    const ack = await cmd('admin.addMember', { username, displayName });
    if (!ack.ok) {
      toast(
        ack.error === 'username_taken'
          ? 'Username đã có'
          : ack.error === 'forbidden'
            ? 'Không đủ quyền'
            : 'Thêm lỗi',
      );
      return;
    }
    const pin = (ack.result as { pin?: string } | undefined)?.pin;
    toast(pin ? `Đã thêm · PIN: ${pin}` : 'Đã thêm');
    if (pin) {
      try {
        await navigator.clipboard.writeText(pin);
      } catch {
        /* ignore */
      }
    }
  });

  root.querySelectorAll('[data-adm-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const memberId = (btn as HTMLElement).dataset.admReset!;
      const who = memberById(memberId)?.displayName || memberId;
      if (!confirm(`Reset PIN của ${who}?`)) return;
      const ack = await cmd('admin.resetPin', { memberId });
      if (!ack.ok) {
        toast(ack.error === 'forbidden' ? 'Không đủ quyền' : 'Reset lỗi');
        return;
      }
      const pin = (ack.result as { pin?: string } | undefined)?.pin;
      toast(pin ? `PIN mới: ${pin}` : 'Đã reset PIN');
      if (pin) {
        try {
          await navigator.clipboard.writeText(pin);
        } catch {
          /* ignore */
        }
      }
    });
  });

  root.querySelectorAll('[data-adm-disable]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const memberId = el.dataset.admDisable!;
      const currentlyDisabled = el.dataset.disabled === '1';
      const who = memberById(memberId)?.displayName || memberId;
      if (!currentlyDisabled && !confirm(`Khóa tài khoản ${who}?`)) return;
      const ack = await cmd('admin.disable', {
        memberId,
        disabled: !currentlyDisabled,
      });
      if (!ack.ok) {
        toast(
          ack.error === 'cannot_disable_self'
            ? 'Không tự khóa mình'
            : ack.error === 'forbidden'
              ? 'Không đủ quyền'
              : 'Lỗi',
        );
        return;
      }
      toast(currentlyDisabled ? 'Đã mở khóa' : 'Đã khóa');
    });
  });
}
