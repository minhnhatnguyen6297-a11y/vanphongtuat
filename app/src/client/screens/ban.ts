import { esc, fmtK, fmtVnd } from '../../shared/esc.js';
import {
  state,
  shopById,
  memberById,
  canPerm,
  effectiveShopId,
  formatDateChip,
  shortShopName,
  patch,
} from '../store.js';
import { ICONS, SHOP_COLORS } from '../icons.js';
import { cmd, setChatSubs } from '../ws.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { copyText } from '../copy.js';
import { setRoute } from '../router.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';

const NOTES = ['ít cay', 'không hành', 'thêm cơm', '50% đường'];
const DRAFT_KEY = 'hng_menu_draft';

function loadDraft(): string[] {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDraft(ids: string[]): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function suggestShops(): { id: string; name: string; why: string }[] {
  const table = state.table;
  const inTable = new Set(table?.shopIds || []);
  const out: { id: string; name: string; why: string }[] = [];
  for (const s of state.shops) {
    if (inTable.has(s.id) || out.length >= 3) continue;
    const times = s.stats?.times ?? 0;
    const last = s.stats?.lastDate;
    let why = '';
    if (times === 0) why = 'Chưa thử';
    else if (last) {
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      if (days >= 14) why = `${days} ngày chưa ăn`;
      else if (times >= 5) why = 'Hay thắng';
    }
    if (!why && times >= 5) why = 'Hay thắng';
    if (why) out.push({ id: s.id, name: s.name, why });
  }
  return out.slice(0, 3);
}

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

function openCopyOrder(): void {
  const table = state.table;
  if (!table) return;
  let mode: 'shop' | 'names' = 'shop';

  const build = () => {
    if (mode === 'shop') {
      const map = new Map<string, number>();
      for (const o of table.orders) {
        const key = o.text.trim();
        map.set(key, (map.get(key) || 0) + 1);
      }
      return [...map.entries()].map(([t, n]) => (n > 1 ? `${n} × ${t}` : t)).join('\n');
    }
    return table.orders
      .map((o) => `${memberById(o.memberId)?.displayName || '?'}: ${o.text}`)
      .join('\n');
  };

  openModal({
    title: 'Copy order',
    bodyHtml: `
      <div class="hn-toggle" style="margin-bottom:12px">
        <button type="button" data-m="shop" aria-pressed="true">Cho quán</button>
        <button type="button" data-m="names" aria-pressed="false">Kèm tên</button>
      </div>
      <pre id="co-pre" style="white-space:pre-wrap;font-family:var(--font-mono);background:#fff;border:2px solid #1B1B1B;padding:10px;min-height:120px"></pre>
      <button type="button" class="hn-btn hn-btn-red" id="co-copy" style="width:100%;margin-top:10px">Sao chép</button>`,
    onMount: (root) => {
      const pre = root.querySelector('#co-pre')!;
      pre.textContent = build();
      root.querySelectorAll('[data-m]').forEach((b) => {
        b.addEventListener('click', () => {
          mode = (b as HTMLElement).dataset.m as 'shop' | 'names';
          root.querySelectorAll('[data-m]').forEach((x) =>
            x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.m === mode)),
          );
          pre.textContent = build();
        });
      });
      root.querySelector('#co-copy')?.addEventListener('click', async () => {
        await copyText(build());
        closeModal();
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

export function titleBan(): { chip: string; fun: string } {
  const t = state.table;
  if (!t) return { chip: 'CHƯA CÓ BÀN', fun: 'CHỌN ĐI CÁC CHÁU!' };
  return { chip: `#${t.id} · ${formatDateChip(t.date)}`, fun: 'CHỌN ĐI CÁC CHÁU!' };
}

export function renderBan(): string {
  const table = state.table;
  if (!table) {
    return `<main class="hn-main"><button type="button" class="hn-btn hn-btn-red" data-act="new-table">+ KÊ BÀN MỚI</button></main>`;
  }

  const voteTotal = table.votes.length || 1;
  const counts = new Map<string, number>();
  for (const id of table.shopIds) counts.set(id, 0);
  for (const v of table.votes) counts.set(v.shopId, (counts.get(v.shopId) || 0) + 1);

  let leadId = table.shopIds[0] || null;
  let leadN = -1;
  for (const id of table.shopIds) {
    const n = counts.get(id) || 0;
    if (n > leadN) {
      leadId = id;
      leadN = n;
    }
  }

  const myVote = table.votes.find((v) => v.memberId === state.me?.id)?.shopId;
  const callingId = effectiveShopId(table);
  const calling = shopById(callingId);
  const draft = new Set(loadDraft());
  state.ui.menuDraftIds = [...draft];

  const shopCards = table.shopIds
    .map((id, i) => {
      const s = shopById(id);
      if (!s) return '';
      const color = SHOP_COLORS[i % SHOP_COLORS.length]!;
      const count = counts.get(id) || 0;
      const pct = Math.round((count / voteTotal) * 100);
      const mine = myVote === id;
      const locked = table.winnerShopId === id;
      const lead = !table.winnerShopId && id === leadId && count > 0;
      const stats = s.stats
        ? `${s.stats.times} lần${s.stats.lastDate ? ` · lần cuối ${formatDateChip(s.stats.lastDate)}` : ''}`
        : '';
      const seats = Array.from({ length: count }, () => ICONS.seat(color)).join('');
      const badges = [
        locked ? '<span class="hn-badge hn-badge-locked">CHỐT</span>' : '',
        lead ? '<span class="hn-badge">DẪN ĐẦU</span>' : '',
        mine ? '<span class="hn-mine-tag" style="padding:2px 6px">GHẾ</span>' : '',
      ]
        .filter(Boolean)
        .join('');
      return `<button type="button" class="hn-shop-card" data-vote="${id}" aria-pressed="${mine}">
        <span class="hn-shop-card-head" style="background:${color}">${esc(s.name.toUpperCase())}</span>
        <span class="hn-shop-card-body">
          <span style="font-family:var(--font-mono);font-size:12px;color:#3D3D3D">${esc(stats)}</span>
          <span style="display:flex;align-items:center;gap:6px;min-height:24px" role="img" aria-label="${count} phiếu">
            ${seats}<span style="font-family:var(--font-display);font-size:22px;line-height:1;margin-left:auto">${count}</span>
          </span>
          <span class="hn-bar"><span style="width:${pct}%;background:${color}"></span></span>
        </span>
        <span class="hn-shop-card-side">
          ${badges}
          ${canPerm('table.setWinner') && !table.winnerShopId ? `<button type="button" class="hn-btn hn-btn-white" data-lock="${id}" style="min-height:36px;font-size:12px">Chốt</button>` : ''}
        </span>
      </button>`;
    })
    .join('');

  const suggests = suggestShops()
    .map(
      (g) =>
        `<button type="button" class="hn-btn-ghost" data-suggest="${g.id}" title="${esc(g.why)}">+ ${esc(g.name)}</button>`,
    )
    .join('');

  const ordersHtml = table.orders
    .map((o) => {
      const mine = o.memberId === state.me?.id;
      const name = memberById(o.memberId)?.displayName || '?';
      return `<button type="button" class="hn-order-row${mine ? ' mine' : ''}" data-order="${o.id}">
        <b style="font-family:var(--font-body);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</b>
        <span>${esc(o.text)}</span>
        <span style="font-weight:700">${esc(fmtK(o.price))}</span>
      </button>`;
    })
    .join('');

  const orderSum = table.orders.reduce((t, o) => t + (o.price || 0), 0);
  const menu = calling?.menu || [];
  const menuHtml = menu
    .map((m) => {
      const on = draft.has(m.id);
      return `<button type="button" class="hn-menu-chip${on ? ' on' : ''}" data-menu="${m.id}">
        ${esc(m.name)}<span style="font-family:var(--font-mono);font-size:11px;font-weight:700">${esc(fmtK(m.price))}</span>
      </button>`;
    })
    .join('');

  const chatScope = `table:${table.id}`;
  const addShopBtn = canPerm('table.addShop')
    ? `<button type="button" class="hn-btn hn-btn-white" data-act="add-shop-kho" style="font-size:13px">+ QUÁN TỪ KHO</button>`
    : '';

  return `<main class="hn-main">
    <div class="hn-ban-layout">
      <section class="hn-ban-cell">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
          <h2 class="hn-h2" style="margin-right:auto">VOTE QUÁN</h2>
          <button type="button" class="hn-btn" data-act="new-table">+ KÊ BÀN MỚI</button>
          <button type="button" class="hn-btn hn-btn-ink" data-act="history">${ICONS.history}LỊCH SỬ BÀN</button>
        </div>
        <div class="hn-ban-scroll">
          <div class="hn-shop-grid">${shopCards}</div>
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px">
            <span style="font-family:var(--font-display);font-size:12px">THÊM QUÁN</span>
            ${suggests}
            ${addShopBtn}
          </div>
        </div>
      </section>
      <section class="hn-ban-cell">
        <div style="display:flex;align-items:center;gap:8px">
          <h2 class="hn-h2" style="margin-right:auto">PHIẾU ORDER · ${esc(shortShopName(calling?.name || '…'))}</h2>
          <button type="button" class="hn-btn hn-btn-white" data-act="copy">${ICONS.copy}Copy order</button>
        </div>
        <div class="hn-order-sheet hn-ban-scroll">
          ${ordersHtml || '<div style="padding:8px;color:#3D3D3D">Chưa ai gọi</div>'}
          <div style="display:flex;justify-content:space-between;padding-top:8px;font-weight:700">
            <span>${table.orders.length} suất</span><span>${esc(fmtVnd(orderSum))}</span>
          </div>
        </div>
      </section>
      <section class="hn-ban-cell">
        ${renderChatPanel(chatScope, { title: 'CHAT BÀN' })}
      </section>
      <section aria-label="Thực đơn" class="hn-panel-yellow hn-ban-cell" style="gap:8px">
        <div class="hn-ban-scroll" style="display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start">${menuHtml}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <input type="text" class="hn-input" id="ban-note" placeholder="Món khác / ghi chú" value="${esc(state.ui.noteDraft)}" style="flex:1 1 160px;min-width:0">
          ${NOTES.map((n) => `<button type="button" class="hn-note-chip" data-note="${esc(n)}">+ ${esc(n)}</button>`).join('')}
          <button type="button" class="hn-btn hn-btn-red" data-act="goi" style="font-size:15px;padding:8px 18px">GỌI</button>
        </div>
      </section>
    </div>
  </main>`;
}

export function bindBan(root: HTMLElement): void {
  const table = state.table;
  if (table) setChatSubs([`table:${table.id}`]);
  else setChatSubs([]);

  root.querySelector('[data-act="new-table"]')?.addEventListener('click', () => openCreateTable());
  root.querySelector('[data-act="history"]')?.addEventListener('click', () => setRoute('so'));
  root.querySelector('[data-act="copy"]')?.addEventListener('click', () => openCopyOrder());
  root.querySelector('[data-act="add-shop-kho"]')?.addEventListener('click', () => setRoute('kho'));
  bindChatPanel(root);

  root.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      if ((e.target as HTMLElement).closest('[data-lock]')) return;
      const shopId = (btn as HTMLElement).dataset.vote!;
      const mine = state.table?.votes.find((v) => v.memberId === state.me?.id)?.shopId === shopId;
      await cmd('vote.set', { shopId: mine ? null : shopId });
    });
  });

  root.querySelectorAll('[data-lock]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await cmd('table.setWinner', { shopId: (btn as HTMLElement).dataset.lock });
      toast('Đã chốt quán');
    });
  });

  root.querySelectorAll('[data-suggest]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await cmd('table.addShop', { shopId: (btn as HTMLElement).dataset.suggest });
    });
  });

  root.querySelectorAll('[data-order]').forEach((btn) => {
    btn.addEventListener('click', () => editOrder((btn as HTMLElement).dataset.order!));
  });

  root.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.menu!;
      const set = new Set(loadDraft());
      if (set.has(id)) set.delete(id);
      else set.add(id);
      saveDraft([...set]);
      patch((s) => {
        s.ui.menuDraftIds = [...set];
      });
    });
  });

  root.querySelectorAll('[data-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const note = (btn as HTMLElement).dataset.note!;
      const input = root.querySelector('#ban-note') as HTMLInputElement;
      const cur = input.value.trim();
      input.value = cur ? `${cur}, ${note}` : note;
      state.ui.noteDraft = input.value;
    });
  });

  const noteInput = root.querySelector('#ban-note') as HTMLInputElement | null;
  noteInput?.addEventListener('input', () => {
    state.ui.noteDraft = noteInput.value;
  });

  root.querySelector('[data-act="goi"]')?.addEventListener('click', async () => {
    const table = state.table;
    const shop = shopById(effectiveShopId(table));
    const draft = loadDraft();
    const items = (shop?.menu || []).filter((m) => draft.includes(m.id));
    const note = ((root.querySelector('#ban-note') as HTMLInputElement)?.value || '').trim();
    let text = items.map((m) => m.name).join(' + ');
    if (note) text = text ? `${text}, ${note}` : note;
    if (!text) {
      toast('Gõ món hoặc chọn thực đơn');
      return;
    }
    let price: number | null = null;
    if (items.length && items.every((m) => m.price != null) && !note) {
      price = items.reduce((t, m) => t + (m.price || 0), 0);
    } else if (items.length && items.every((m) => m.price != null) && note) {
      // note present → price null if free-text mixed, else sum still ok when note is only modifier
      price = items.reduce((t, m) => t + (m.price || 0), 0);
    } else if (!items.length) {
      price = null;
    } else {
      price = null;
    }
    await cmd('order.add', { text: text.slice(0, 120), price });
    saveDraft([]);
    state.ui.noteDraft = '';
    patch((s) => {
      s.ui.menuDraftIds = [];
      s.ui.noteDraft = '';
    });
    toast('Đã gọi');
  });
}
