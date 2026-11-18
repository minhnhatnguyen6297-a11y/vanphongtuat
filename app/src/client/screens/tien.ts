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
import { chooseImage, readClipboardImage, resizeImage, type ImageBlob } from '../image.js';
import { apiAi } from '../api.js';
import type { BillView } from '../../shared/bill-read.js';
import { waitAi } from '../ws.js';
import { toast } from '../ui/toast.js';
import { openAvatarModal } from '../ui/avatar.js';

function asBill(raw: unknown): BillView | null {
  if (!raw || typeof raw !== 'object' || !('lines' in raw)) return null;
  return raw as BillView;
}

function storeBill(view: BillView | null): void {
  patch((s) => {
    s.ui.aiBill = view;
    s.ui.aiBillTotal = view && typeof view.total === 'number' ? view.total : null;
  });
}

async function applyAiTotal(view: BillView | null): Promise<void> {
  if (!view || view.total == null) {
    toast('AI không đọc được tổng');
    return;
  }
  const input = document.querySelector('#bill-total') as HTMLInputElement | null;
  if (input) input.value = String(view.total);
  const table = state.table;
  if (!canPerm('table.setBill') || !table) {
    toast('Đã điền tổng. Chưa lưu.');
    return;
  }
  await cmd('table.setBill', { total: view.total, mode: 'equal' }, table.version);
  toast('Đã điền tổng');
}

async function finishBillJob(jobId: string | undefined, status?: number, error?: string): Promise<void> {
  if (status === 503 || error === 'ai_disabled') {
    toast('AI chưa bật, nhập tay nhé');
    return;
  }
  if (status === 429) {
    toast('AI đang bận, thử lại sau chút');
    return;
  }
  if (!jobId) return;
  const ai = await waitAi(jobId);
  if (!ai.ok || !ai.result) {
    toast('Không đọc được bill');
    return;
  }
  const view = asBill(ai.result);
  storeBill(view);
  await applyAiTotal(view);
}

export async function handleBillImage(img: ImageBlob): Promise<void> {
  if (state.ui.billPreviewUrl) URL.revokeObjectURL(state.ui.billPreviewUrl);
  patch((s) => {
    s.ui.billPreviewUrl = img.url;
    s.ui.aiBillTotal = null;
    s.ui.aiBill = null;
  });
  const res = await apiAi('bill', img.blob);
  await finishBillJob(res.jobId, res.status, res.error);
}

export function titleTien(): { chip: string; fun: string } {
  const t = state.table;
  const shop = shopById(effectiveShopId(t));
  const chip = t ? `#${t.id} · ${shortShopName(shop?.name || '…')}` : 'CHIA TIỀN';
  return { chip, fun: 'TÍNH TIỀN EM ƠI!' };
}

function moneyText(n: number | null): string {
  if (n == null) return '—';
  return fmtVnd(n);
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
    mode: 'equal',
    hostId: table.hostId,
  });
  const hostMember = memberById(table.hostId);
  const hasBank = !!(hostMember?.bankBin && hostMember.bankAccount);
  const payerName = state.me?.displayName || '';
  const showQr = hasBank && !result.empty && table.billTotal != null;
  const eachText = result.empty || table.billTotal == null ? '—' : fmtVnd(result.each);

  return `<main class="hn-main">
    <div class="hn-two-col-tien">
      <section class="hn-panel hn-paper-fold hn-bill-panel hn-stack">
        <div class="hn-section-head"><h2 class="hn-h2"><span>BILL</span></h2></div>
        <div class="hn-bill-source">
          <div class="hn-bill-receipt" data-drop-bill tabindex="0" role="button" aria-label="Thả hoặc dán ảnh bill">
            ${
              state.ui.billPreviewUrl
                ? `<img src="${state.ui.billPreviewUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain">`
                : `<span style="font-family:var(--font-display);font-size:12px;text-align:center">Thả hoặc dán ảnh</span>`
            }
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="hn-btn hn-btn-white" data-act="paste" style="flex:1">Dán ảnh</button>
            <button type="button" class="hn-btn hn-btn-white" data-act="pick" style="flex:1">Chọn ảnh</button>
          </div>
        </div>
        <label style="display:flex;flex-direction:column;gap:4px">
          <span style="font-family:var(--font-display);font-size:14px">TỔNG TIỀN</span>
          <span style="display:flex;align-items:center;background:#fff;border:3px solid #1B1B1B">
            <input type="number" inputmode="numeric" id="bill-total" ${canBill ? '' : 'readonly'} value="${table.billTotal ?? ''}" placeholder="" style="flex:1;min-width:0;font-family:var(--font-mono);font-weight:700;font-size:32px;background:transparent;border:0;padding:8px 12px;min-height:60px;text-align:right">
            <span style="font-family:var(--font-mono);font-weight:700;font-size:22px;padding-right:12px">đ</span>
          </span>
        </label>
      </section>
      <section class="hn-panel hn-paper-fold hn-bill-shares" style="font-family:var(--font-mono);display:flex;flex-direction:column;gap:10px">
        <div class="hn-section-head">
          <h2 class="hn-h2"><span>KẾT QUẢ</span></h2>
        </div>
        <div class="hn-split-result">
          <p><span>Tổng tiền</span><b data-bill>${esc(moneyText(table.billTotal))}</b></p>
          <p><span>Mỗi người</span><b data-each>${esc(eachText)}</b></p>
        </div>
        ${result.empty ? '<p class="hn-split-empty">Chưa ai gọi món</p>' : ''}
        <div class="hn-qr-box">
          ${
            showQr
              ? `<div id="qr-mount" data-amount="${result.each}" data-name="${esc(payerName)}"></div>
                 <div style="min-width:0;font-size:13px;line-height:1.5">
                   <b style="font-family:var(--font-body);font-size:16px">VietQR Chủ xị · ${esc(fmtVnd(result.each))}</b><br>
                   ${esc(hostMember?.bankNameDisplay || 'NH')} · ${esc(hostMember?.bankAccount || '')}<br>
                   <span style="font-weight:700">#${table.id} ${esc(stripDiacritics(payerName).toUpperCase())}</span>
                 </div>`
              : result.empty
                ? '<span style="font-weight:800">Chưa có mã</span>'
                : !hasBank
                  ? `<button type="button" class="hn-btn" data-act="add-stk">Thêm STK</button>
                 <span style="font-weight:800">Chủ xị chưa nhập STK</span>`
                  : '<span style="font-weight:800">Nhập tổng để hiện VietQR</span>'
          }
        </div>
        <span class="hn-art-coffee" aria-hidden="true"></span>
      </section>
    </div>
  </main>`;
}

export function bindTien(root: HTMLElement): void {
  const table = state.table;
  if (!table) return;

  const onImage = async (img: ImageBlob | null) => {
    if (img) await handleBillImage(img);
  };

  root.querySelector('[data-act="pick"]')?.addEventListener('click', async () => {
    await onImage(await chooseImage());
  });

  root.querySelector('[data-act="paste"]')?.addEventListener('click', async () => {
    const img = await readClipboardImage();
    if (!img) {
      toast('Clipboard không có ảnh — thử Ctrl+V');
      return;
    }
    await onImage(img);
  });

  const drop = root.querySelector('[data-drop-bill]');
  drop?.addEventListener('click', async () => {
    await onImage(await chooseImage());
  });
  drop?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault();
      void chooseImage().then((img) => onImage(img));
    }
  });
  drop?.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop?.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop?.addEventListener('drop', async (e) => {
    const ev = e as DragEvent;
    ev.preventDefault();
    drop.classList.remove('is-over');
    const file = ev.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast('Thả một file ảnh');
      return;
    }
    await onImage(await resizeImage(file));
  });

  const billInput = root.querySelector('#bill-total') as HTMLInputElement | null;
  const saveBill = async () => {
    if (!canPerm('table.setBill') || !billInput || !state.table) return;
    const raw = billInput.value.trim();
    const total = raw === '' ? null : Number(raw);
    if (total != null && !Number.isFinite(total)) return;
    await cmd('table.setBill', { total, mode: 'equal' }, state.table.version);
  };
  billInput?.addEventListener('change', () => void saveBill());
  billInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void saveBill();
  });

  root.querySelector('[data-act="add-stk"]')?.addEventListener('click', () => openAvatarModal());

  const mount = root.querySelector('#qr-mount') as HTMLElement | null;
  if (mount) {
    const hostMember = memberById(table.hostId)!;
    const amount = Number(mount.dataset.amount || 0);
    const name = stripDiacritics(mount.dataset.name || '').toUpperCase();
    const desc = `#${table.id} ${name}`.trim().slice(0, 25);
    const payload = buildVietQrPayload({
      bankBin: hostMember.bankBin || '',
      account: hostMember.bankAccount || '',
      amount,
      description: desc,
    });
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const modules = qr.getModuleCount();
    const cell = 3;
    const margin = 4 * cell;
    const size = modules * cell + 2 * margin;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Mã VietQR');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(margin + c * cell, margin + r * cell, cell, cell);
      }
    }
    mount.replaceWith(canvas);
  }
}
