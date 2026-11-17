import { esc } from '../../shared/esc.js';
import { findShops } from '../../shared/shop-find.js';
import {
  state,
  shopById,
  memberById,
  canPerm,
  formatDateChip,
  patch,
} from '../store.js';
import { ICONS } from '../icons.js';
import { cmd, setChatSubs } from '../ws.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { setRoute } from '../router.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';

let findQuery = '';
let findFocused = false;

function openCreateTable(): void {
  const suggested = state.shops.slice(0, 3).map((s) => s.id);
  const selected = new Set(suggested);
  let voteEndsInSec = 0;
  openModal({
    title: 'KÊ BÀN MỚI',
    bodyHtml: `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px" id="ct-shops">
      ${state.shops
        .map(
          (s) =>
            `<button type="button" class="hn-btn hn-btn-white" data-sid="${s.id}" aria-pressed="${selected.has(s.id)}" style="font-family:var(--font-body)">${esc(s.name)}</button>`,
        )
        .join('')}
    </div>
    <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:13px;font-weight:800">Đếm ngược vote (giây, 0 = tắt)
      <input class="hn-input" id="ct-vote-sec" type="number" min="0" max="86400" value="0" style="font-family:var(--font-mono)">
    </label>
    <button type="button" class="hn-btn hn-btn-red" id="ct-go" style="width:100%">KÊ BÀN</button>`,
    onMount: (root) => {
      root.querySelectorAll('[data-sid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.sid!;
          if (selected.has(id)) selected.delete(id);
          else selected.add(id);
          (btn as HTMLElement).setAttribute('aria-pressed', String(selected.has(id)));
          (btn as HTMLElement).style.background = selected.has(id) ? '#1B1B1B' : '#fff';
          (btn as HTMLElement).style.color = selected.has(id) ? '#FFF4D6' : '#1B1B1B';
        });
        if (selected.has((btn as HTMLElement).dataset.sid!)) {
          (btn as HTMLElement).style.background = '#1B1B1B';
          (btn as HTMLElement).style.color = '#FFF4D6';
        }
      });
      root.querySelector('#ct-go')?.addEventListener('click', async () => {
        if (!selected.size) {
          toast('Chọn ít nhất 1 quán');
          return;
        }
        const raw = Number((root.querySelector('#ct-vote-sec') as HTMLInputElement)?.value || 0);
        voteEndsInSec = Number.isFinite(raw) ? Math.max(0, Math.min(86_400, Math.floor(raw))) : 0;
        await cmd('table.create', {
          shopIds: [...selected],
          ...(voteEndsInSec > 0 ? { voteEndsInSec } : {}),
        });
        closeModal();
        toast('Đã kê bàn');
      });
    },
  });
}

function editOrder(orderId: string): void {
  const table = state.table;
  const o = table?.orders.find((x) => x.id === orderId);
  if (!o || !table) return;
  const can = state.me?.id === o.memberId || canPerm('order.edit_others');
  if (!can) return;
  openModal({
    title: 'Sửa món',
    bodyHtml: `
      <input class="hn-input" id="eo-text" value="${esc(o.text)}" maxlength="120">
      <input class="hn-input" id="eo-price" type="number" inputmode="numeric" placeholder="Giá (để trống = ?)" value="${o.price ?? ''}" style="margin-top:8px">
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" class="hn-btn" id="eo-save">Lưu</button>
        <button type="button" class="hn-btn hn-btn-red" id="eo-del">Xoá</button>
      </div>`,
    onMount: (root) => {
      root.querySelector('#eo-save')?.addEventListener('click', async () => {
        const text = (root.querySelector('#eo-text') as HTMLInputElement).value.trim();
        const priceRaw = (root.querySelector('#eo-price') as HTMLInputElement).value;
        const price = priceRaw === '' ? null : Number(priceRaw);
        await cmd('order.update', { id: o.id, text, price }, o.version);
        closeModal();
      });
      root.querySelector('#eo-del')?.addEventListener('click', async () => {
        await cmd('order.remove', { id: o.id });
        closeModal();
      });
    },
  });
}

function voterLine(shopId: string): string {
  const table = state.table;
  if (!table) return 'Chưa ai chọn';
  const names = table.votes
    .filter((v) => v.shopId === shopId)
    .map((v) => memberById(v.memberId)?.displayName || 'Ẩn danh');
  return names.length ? names.join(', ') : 'Chưa ai chọn';
}

function findResultsHtml(shopIds: string[]): string {
  if (!findQuery.trim()) return '';
  const hits = findShops(state.shops, findQuery);
  if (!hits.length) return '<p class="hn-find-empty">Không thấy món hoặc quán khớp.</p>';
  const onTable = new Set(shopIds);
  const canAdd = canPerm('table.addShop');
  return hits
    .map((hit) => {
      const already = onTable.has(hit.id);
      const lockedOut = !already && !canAdd;
      const dish = hit.dishes.length ? hit.dishes.join(', ') : 'Khớp tên quán';
      const hint = lockedOut ? 'Không có quyền thêm quán' : already ? `${dish} · đã có trong bàn` : dish;
      return `<button type="button" class="hn-find-hit" data-pick="${esc(hit.id)}" ${lockedOut ? 'disabled' : ''}>
        <b>${esc(hit.name)}</b>
        <small>${esc(hint)}</small>
      </button>`;
    })
    .join('');
}

async function pickShop(shopId: string): Promise<boolean> {
  const previous = findQuery;
  findQuery = '';
  const ack = await cmd('vote.place', { shopId });
  if (!ack.ok) {
    findQuery = previous;
    toast(ack.error === 'forbidden' ? 'Không có quyền thêm quán' : 'Chưa chọn được quán');
    return false;
  }
  const added = (ack.result as { added?: boolean } | undefined)?.added;
  toast(added ? 'Đã đưa quán vào bàn' : 'Đã chọn quán');
  return true;
}

export function titleBan(): { chip: string; fun: string } {
  const t = state.table;
  if (!t) return { chip: 'CHƯA CÓ BÀN', fun: 'CHỌN ĐI CÁC CHÁU!' };
  return { chip: `#${t.id} · ${formatDateChip(t.date)}`, fun: 'CHỌN ĐI CÁC CHÁU!' };
}

export function renderBan(): string {
  const table = state.table;
  if (!table) {
    const canCreate = canPerm('table.create');
    return `<main class="hn-main">
      <section class="hn-panel hn-paper-fold hn-ban-empty">
        <h2 class="hn-h2"><span>CHƯA KÊ BÀN</span></h2>
        <p>${canCreate ? 'Chưa có quán để bình chọn và chưa có món để gọi. Bấm Kê bàn để bắt đầu.' : 'Chưa có bàn. Cần người có quyền kê bàn.'}</p>
        ${canCreate ? '<button type="button" class="hn-btn hn-btn-red" data-act="new-table">+ KÊ BÀN</button>' : ''}
      </section>
    </main>`;
  }

  const myVote = table.votes.find((v) => v.memberId === state.me?.id)?.shopId;
  const shopCards = table.shopIds
    .map((id) => {
      const s = shopById(id);
      if (!s) return '';
      const mine = myVote === id;
      const locked = table.winnerShopId === id;
      return `<div class="hn-shop-card">
        <button type="button" class="hn-shop-vote" data-vote="${esc(id)}" aria-pressed="${mine}">
          <span class="hn-shop-card-head"><b>${esc(s.name)}</b>${locked ? '<span class="hn-shop-locked">Đã chốt</span>' : ''}</span>
          <span class="hn-shop-voters">${esc(voterLine(id))}</span>
        </button>
        ${canPerm('table.setWinner') && !table.winnerShopId ? `<button type="button" class="hn-btn hn-btn-white hn-shop-lock" data-lock="${esc(id)}" aria-label="Chốt ${esc(s.name)}">Chốt</button>` : ''}
      </div>`;
    })
    .join('');

  const ordersHtml = table.orders
    .map((o) => {
      const mine = o.memberId === state.me?.id;
      const name = memberById(o.memberId)?.displayName || '?';
      const line = `${name} · ${o.text}`;
      return `<button type="button" class="hn-order-line${mine ? ' mine' : ''}" data-order="${esc(o.id)}" title="${esc(line)}">${esc(line)}</button>`;
    })
    .join('');

  const chatScope = `table:${table.id}`;

  return `<main class="hn-main">
    <div class="hn-ban-layout">
      <section class="hn-panel hn-paper-fold hn-ban-cell">
        <div class="hn-section-head">
          <h2 class="hn-h2"><span>BÌNH CHỌN</span></h2>
          ${canPerm('table.create') ? '<button type="button" class="hn-btn hn-btn-blue" data-act="new-table">+ KÊ BÀN MỚI</button>' : ''}
          <button type="button" class="hn-btn hn-btn-white" data-act="history">${ICONS.history}LỊCH SỬ BÀN</button>
        </div>
        <div class="hn-find">
          <label class="hn-find-label" for="ban-find">Tìm món hoặc quán
            <input type="search" class="hn-input" id="ban-find" placeholder="Tìm món hoặc quán" autocomplete="off" value="${esc(findQuery)}">
          </label>
          <div class="hn-find-results" id="ban-find-results">${findResultsHtml(table.shopIds)}</div>
        </div>
        <div class="hn-shop-grid hn-ban-scroll">${shopCards || '<p class="hn-order-empty">Chưa có quán trong bàn. Gõ món hoặc tên quán ở ô tìm.</p>'}</div>
      </section>
      <section class="hn-panel hn-paper-fold hn-ban-cell">
        <div class="hn-section-head">
          <h2 class="hn-h2"><span>GỌI MÓN</span></h2>
        </div>
        <div class="hn-call-row">
          <input type="text" class="hn-input" id="ban-note" maxlength="120" placeholder="Món của bạn" value="${esc(state.ui.noteDraft)}" aria-label="Món của bạn">
          <button type="button" class="hn-btn hn-btn-red" data-act="goi">Gọi</button>
        </div>
        <div class="hn-order-compact">
          ${ordersHtml || '<p class="hn-order-empty">Chưa ai gọi món</p>'}
        </div>
        ${renderChatPanel(chatScope, { title: 'CHAT BÀN', collapsible: true })}
      </section>
    </div>
  </main>`;
}

function bindFind(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('#ban-find');
  const box = root.querySelector<HTMLElement>('#ban-find-results');
  if (!input || !box) return;

  const paint = () => {
    const ids = state.table?.shopIds ?? [];
    box.innerHTML = findResultsHtml(ids);
    box.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.pick;
        if (!id) return;
        const ok = await pickShop(id);
        if (ok) {
          input.value = '';
          box.innerHTML = '';
          return;
        }
        paint();
      });
    });
  };

  if (findFocused) {
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }
  input.addEventListener('focus', () => {
    findFocused = true;
  });
  input.addEventListener('blur', () => {
    findFocused = false;
  });
  input.addEventListener('input', () => {
    findQuery = input.value;
    paint();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const first = box.querySelector<HTMLButtonElement>('[data-pick]:not([disabled])');
    first?.click();
  });
  paint();
}

export function bindBan(root: HTMLElement): void {
  const table = state.table;
  if (table) setChatSubs([`table:${table.id}`]);
  else setChatSubs([]);

  root.querySelector('[data-act="new-table"]')?.addEventListener('click', () => openCreateTable());
  root.querySelector('[data-act="history"]')?.addEventListener('click', () => setRoute('so'));
  bindChatPanel(root);
  bindFind(root);

  root.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const shopId = (btn as HTMLElement).dataset.vote!;
      const mine = state.table?.votes.find((v) => v.memberId === state.me?.id)?.shopId === shopId;
      await cmd('vote.set', { shopId: mine ? null : shopId });
    });
  });

  root.querySelectorAll('[data-lock]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await cmd('table.setWinner', { shopId: (btn as HTMLElement).dataset.lock });
      toast('Đã chốt quán');
    });
  });

  root.querySelectorAll('[data-order]').forEach((btn) => {
    btn.addEventListener('click', () => editOrder((btn as HTMLElement).dataset.order!));
  });

  const noteInput = root.querySelector('#ban-note') as HTMLInputElement | null;
  noteInput?.addEventListener('input', () => {
    state.ui.noteDraft = noteInput.value;
  });

  root.querySelector('[data-act="goi"]')?.addEventListener('click', async () => {
    const text = (noteInput?.value || '').trim().slice(0, 120);
    if (!text) {
      toast('Gõ món rồi bấm Gọi');
      return;
    }
    const ack = await cmd('order.add', { text, price: null });
    if (!ack.ok) {
      toast('Chưa gọi được');
      return;
    }
    state.ui.noteDraft = '';
    if (noteInput) noteInput.value = '';
    patch((s) => {
      s.ui.noteDraft = '';
    });
    toast('Đã gọi');
  });
}
