// CJS default — esbuild bundles fine
import qrcode from 'qrcode-generator';
import { esc, fmtVnd, stripDiacritics } from '../../shared/esc.js';
import { split } from '../../shared/split.js';
import { buildVietQrPayload } from '../../shared/vietqr.js';
import {
  state,
  memberById,
  shopById,
  canPerm,
  effectiveShopId,
  shortShopName,
  patch,
} from '../store.js';
import { cmd } from '../ws.js';
import { copyText } from '../copy.js';
import { chooseImage, readClipboardImage, type ImageBlob } from '../image.js';
import { apiAi } from '../api.js';
import { waitAi } from '../ws.js';
import { toast } from '../ui/toast.js';
import { openAvatarModal } from '../ui/avatar.js';

async function handleBillImage(img: ImageBlob): Promise<void> {
  if (state.ui.billPreviewUrl) URL.revokeObjectURL(state.ui.billPreviewUrl);
  patch((s) => {
    s.ui.billPreviewUrl = img.url;
    s.ui.aiBillTotal = null;
  });
  const res = await apiAi('bill', img.blob);
  if (res.status === 503 || res.error === 'ai_disabled') {
    toast('AI chưa bật, nhập tay nhé');
    return;
  }
  if (res.status === 429) {
    toast('AI đang bận, thử lại sau chút');
    return;
  }
  if (!res.jobId) return;
  const ai = await waitAi(res.jobId);
  if (ai.ok && ai.result && typeof (ai.result as { total?: number }).total === 'number') {
    patch((s) => {
      s.ui.aiBillTotal = (ai.result as { total: number }).total;
    });
  }
}

export function titleTien(): { chip: string; fun: string } {
  const t = state.table;
  const shop = shopById(effectiveShopId(t));
  const chip = t ? `#${t.id} · ${shortShopName(shop?.name || '…')}` : 'TÍNH TIỀN';
  return { chip, fun: 'TÍNH TIỀN EM ƠI!' };
}

export function renderTien(): string {
  const table = state.table;
  if (!table) {
    return `<main class="hn-main"><p>Chưa có bàn.</p></main>`;
  }
  const canBill = canPerm('table.setBill');
  const result = split({
    orders: table.orders.map((o) => ({ memberId: o.memberId, price: o.price })),
    billTotal: table.billTotal,
    mode: table.billMode,
    hostId: table.hostId,
  });

  const hasEst = table.orders.some((o) => o.price == null);
  const orderSumText = fmtVnd(result.orderSum) + (hasEst ? ' (ước)' : '');
  const diff = result.bill - result.orderSum;
  const bigDiff = result.orderSum > 0 && Math.abs(diff) / result.orderSum > 0.15;

  if (!state.ui.selectedPersonId && result.rows[0]) {
    state.ui.selectedPersonId = result.rows[0].memberId;
  }

  const peopleHtml = result.empty
    ? `<div style="padding:12px;font-weight:800">Chưa ai gọi món</div>`
    : result.rows
        .map((r) => {
          const m = memberById(r.memberId);
          const texts = table.orders
            .filter((o) => o.memberId === r.memberId)
            .map((o) => o.text)
            .join(' · ');
          const sel = state.ui.selectedPersonId === r.memberId;
          return `<button type="button" class="hn-person-row" data-person="${r.memberId}" aria-pressed="${sel}" style="background:${sel ? '#FFF4D6' : 'transparent'}">
            <b style="font-family:var(--font-body);font-size:15px">${esc(m?.displayName || '?')}</b>
            <b style="font-size:17px">${esc(fmtVnd(r.share))}</b>
            <span style="font-size:12px;color:#3D3D3D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(texts)}</span>
            <span style="font-size:11px;font-weight:700;color:#B71C1C">${r.estimated && table.billMode === 'item' ? '~ giá TB' : ''}</span>
          </button>`;
        })
        .join('');

  const hostMember = memberById(table.hostId);
  const sel = memberById(state.ui.selectedPersonId);
  const selRow = result.rows.find((r) => r.memberId === state.ui.selectedPersonId);
  const hasBank = !!(hostMember?.bankBin && hostMember.bankAccount);

  return `<main class="hn-main">
    <div class="hn-two-col-tien">
      <section class="hn-panel-yellow" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;gap:12px;align-items:stretch">
          <div aria-label="Ảnh bill" style="flex:0 0 96px;height:120px;background:#fff;border:3px solid #1B1B1B;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px">
            ${
              state.ui.billPreviewUrl
                ? `<img src="${state.ui.billPreviewUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain">`
                : `<span style="font-family:var(--font-display);font-size:12px;text-align:center">CHƯA CÓ BILL</span>`
            }
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">
            <div style="display:flex;gap:6px">
              <button type="button" class="hn-btn hn-btn-white" data-act="paste" style="flex:1">Dán ảnh</button>
              <button type="button" class="hn-btn hn-btn-white" data-act="pick" style="flex:1">Chọn ảnh</button>
            </div>
            <span style="font-size:12px;color:#3D3D3D">Hoặc Ctrl+V khi đang ở màn này</span>
            ${
              state.ui.aiBillTotal != null
                ? `<span style="font-size:13px;font-weight:800;background:#fff;border:2px solid #1B1B1B;padding:4px 8px;align-self:flex-start">AI đọc: ${esc(fmtVnd(state.ui.aiBillTotal))}</span>`
                : ''
            }
          </div>
        </div>
        <label style="display:flex;flex-direction:column;gap:4px">
          <span style="font-family:var(--font-display);font-size:14px">TỔNG BILL</span>
          <span style="display:flex;align-items:center;background:#fff;border:3px solid #1B1B1B">
            <input type="number" inputmode="numeric" id="bill-total" ${canBill ? '' : 'readonly'} value="${table.billTotal ?? ''}" placeholder="" style="flex:1;min-width:0;font-family:var(--font-mono);font-weight:700;font-size:32px;background:transparent;border:0;padding:8px 12px;min-height:60px;text-align:right">
            <span style="font-family:var(--font-mono);font-weight:700;font-size:22px;padding-right:12px">đ</span>
          </span>
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px">
          <span style="font-family:var(--font-mono)">order ${esc(orderSumText)}</span>
          ${bigDiff ? `<span style="font-weight:800;background:#C62828;color:#fff;border:2px solid #1B1B1B;padding:2px 8px">lệch ${diff > 0 ? '+' : ''}${esc(fmtVnd(diff))}</span>` : ''}
        </div>
        <div class="hn-toggle" role="group" aria-label="Cách chia">
          <button type="button" data-mode="item" aria-pressed="${table.billMode === 'item'}" ${canBill ? '' : 'disabled'}>THEO MÓN</button>
          <button type="button" data-mode="equal" aria-pressed="${table.billMode === 'equal'}" ${canBill ? '' : 'disabled'}>CHIA ĐỀU</button>
        </div>
      </section>
      <section class="hn-panel" style="font-family:var(--font-mono);display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <h2 class="hn-h2" style="margin-right:auto;font-size:20px">MỖI NGƯỜI</h2>
          <button type="button" class="hn-btn hn-btn-red" data-act="copy-group">COPY GỬI NHÓM</button>
        </div>
        <div>${peopleHtml}</div>
        <div style="display:flex;align-items:baseline;gap:10px;font-family:var(--font-display);font-size:18px;border-top:3px solid #1B1B1B;padding-top:8px;flex-wrap:wrap">
          <span>TỔNG</span>
          ${result.hostCovers > 0 ? `<span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:#B71C1C">Chủ xị gánh lẻ +${esc(fmtVnd(result.hostCovers))}</span>` : ''}
          ${
            canBill
              ? `<label style="display:flex;align-items:center;gap:6px;font-family:var(--font-body);font-size:12px;font-weight:700">
                   Gánh lẻ
                   <select id="residual-host" class="hn-input" style="min-height:32px;font-size:12px;max-width:160px">
                     ${state.members
                       .filter((m) => !m.disabled)
                       .map(
                         (m) =>
                           `<option value="${esc(m.id)}" ${m.id === table.hostId ? 'selected' : ''}>${esc(m.displayName)}</option>`,
                       )
                       .join('')}
                   </select>
                 </label>`
              : ''
          }
          <span style="margin-left:auto">${esc(fmtVnd(result.bill))}</span>
        </div>
        <div class="hn-qr-box">
          ${
            hasBank && selRow
              ? `<div id="qr-mount" data-amount="${selRow.share}" data-name="${esc(sel?.displayName || '')}"></div>
                 <div style="min-width:0;font-size:13px;line-height:1.5">
                   <b style="font-family:var(--font-body);font-size:16px">${esc(sel?.displayName || '')} · ${esc(fmtVnd(selRow.share))}</b><br>
                   ${esc(hostMember?.bankNameDisplay || 'NH')} · ${esc(hostMember?.bankAccount || '')}<br>
                   <span style="font-weight:700">#${table.id} ${esc(stripDiacritics(sel?.displayName || '').toUpperCase())}</span>
                 </div>`
              : `<button type="button" class="hn-btn" data-act="add-stk">Thêm STK</button>
                 <span style="font-weight:800">Chủ xị chưa nhập STK</span>`
          }
        </div>
      </section>
    </div>
  </main>`;
}

export function bindTien(root: HTMLElement): void {
  const table = state.table;
  if (!table) return;

  root.querySelector('[data-act="pick"]')?.addEventListener('click', async () => {
    const img = await chooseImage();
    if (img) await handleBillImage(img);
  });

  root.querySelector('[data-act="paste"]')?.addEventListener('click', async () => {
    const img = await readClipboardImage();
    if (!img) {
      toast('Clipboard không có ảnh — thử Ctrl+V');
      return;
    }
    await handleBillImage(img);
  });

  const billInput = root.querySelector('#bill-total') as HTMLInputElement | null;
  const saveBill = async () => {
    if (!canPerm('table.setBill') || !billInput) return;
    const raw = billInput.value.trim();
    const total = raw === '' ? null : Number(raw);
    await cmd('table.setBill', { total, mode: table.billMode }, table.version);
  };
  billInput?.addEventListener('change', () => void saveBill());
  billInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void saveBill();
  });

  // apply AI suggestion into field only (host still saves)
  if (
    state.ui.aiBillTotal != null &&
    billInput &&
    canPerm('table.setBill') &&
    document.activeElement !== billInput
  ) {
    // show AI value as hint only — already chip; if field empty, fill draft visually once
    if (billInput.value === '' && state.ui.aiBillTotal != null) {
      billInput.value = String(state.ui.aiBillTotal);
    }
  }

  root.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!canPerm('table.setBill')) return;
      const mode = (btn as HTMLElement).dataset.mode as 'item' | 'equal';
      await cmd('table.setBill', { total: table.billTotal, mode }, table.version);
    });
  });

  root.querySelector('#residual-host')?.addEventListener('change', async (e) => {
    if (!canPerm('table.setBill')) return;
    const memberId = (e.target as HTMLSelectElement).value;
    if (!memberId || memberId === table.hostId) return;
    const ack = await cmd('table.setResidualHost', { memberId }, table.version);
    if (!ack.ok) toast(ack.error === 'forbidden' ? 'Không đủ quyền' : 'Không đổi được');
  });

  root.querySelectorAll('[data-person]').forEach((btn) => {
    btn.addEventListener('click', () => {
      patch((s) => {
        s.ui.selectedPersonId = (btn as HTMLElement).dataset.person!;
      });
    });
  });

  root.querySelector('[data-act="copy-group"]')?.addEventListener('click', async () => {
    const result = split({
      orders: table.orders.map((o) => ({ memberId: o.memberId, price: o.price })),
      billTotal: table.billTotal,
      mode: table.billMode,
      hostId: table.hostId,
    });
    const lines = result.rows.map((r) => {
      const name = memberById(r.memberId)?.displayName || '?';
      return `${name}: ${fmtVnd(r.share)}`;
    });
    if (result.hostCovers > 0) lines.push(`Chủ xị gánh lẻ: ${fmtVnd(result.hostCovers)}`);
    lines.push(`Tổng: ${fmtVnd(result.bill)}`);
    await copyText(lines.join('\n'));
  });

  root.querySelector('[data-act="add-stk"]')?.addEventListener('click', () => openAvatarModal());

  const mount = root.querySelector('#qr-mount') as HTMLElement | null;
  if (mount) {
    const hostMember = memberById(table.hostId)!;
    const amount = Number(mount.dataset.amount || 0);
    const name = stripDiacritics(mount.dataset.name || '').toUpperCase();
    const desc = `#${table.id} ${name}`.slice(0, 25);
    const payload = buildVietQrPayload({
      bankBin: hostMember.bankBin || '',
      account: hostMember.bankAccount || '',
      amount,
      description: desc,
    });
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const size = 84;
    const cell = size / qr.getModuleCount();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1B1B1B';
    for (let r = 0; r < qr.getModuleCount(); r++) {
      for (let c = 0; c < qr.getModuleCount(); c++) {
        if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    mount.replaceWith(canvas);
  }
}

export { handleBillImage };
