import { esc, fmtVnd } from '../../shared/esc.js';
import { split } from '../../shared/split.js';
import {
  state,
  shopById,
  memberById,
  formatDateChip,
  effectiveShopId,
  patch,
} from '../store.js';
import { ICONS } from '../icons.js';
import { cmd } from '../ws.js';
import { setRoute } from '../router.js';
import { toast } from '../ui/toast.js';
import type { TableRow } from '../../shared/types.js';

function tableTotal(t: TableRow): number {
  if (t.billTotal != null) return t.billTotal;
  return t.orders.reduce((s, o) => s + (o.price || 0), 0);
}

function peopleCount(t: TableRow): number {
  return new Set(t.orders.map((o) => o.memberId)).size || t.votes.length;
}

export function titleSo(): { chip: string; fun: string } {
  const tables = [...state.tables].sort((a, b) => b.id - a.id);
  const now = new Date();
  const month = now.getMonth() + 1;
  const sum = tables.reduce((s, t) => s + tableTotal(t), 0);
  return {
    chip: `THÁNG ${String(month).padStart(2, '0')} · ${tables.length} BÀN · ${fmtVnd(sum)}`,
    fun: 'ĂN XONG LÀ XONG!',
  };
}

export function renderSo(): string {
  const tables = [...state.tables].sort((a, b) => b.id - a.id);
  const openId = state.ui.expandedLedgerId;

  const rows = tables
    .map((t) => {
      const open = openId === t.id;
      const shop = shopById(t.winnerShopId || effectiveShopId(t));
      const total = tableTotal(t);
      let detail = '';
      if (open) {
        const result = split({
          orders: t.orders.map((o) => ({ memberId: o.memberId, price: o.price })),
          billTotal: t.billTotal,
          mode: t.billMode,
          hostId: t.hostId,
        });
        const lines = result.rows
          .map((r) => {
            const name = memberById(r.memberId)?.displayName || '?';
            const what = t.orders
              .filter((o) => o.memberId === r.memberId)
              .map((o) => o.text)
              .join(' · ');
            return `<div style="display:grid;grid-template-columns:minmax(0,10em) 1fr auto;gap:10px">
              <b style="font-family:var(--font-body)">${esc(name)}</b>
              <span>${esc(what)}</span>
              <span style="font-weight:700">${esc(fmtVnd(r.share))}</span>
            </div>`;
          })
          .join('');
        const cover =
          result.hostCovers > 0
            ? `<div style="color:#B71C1C;font-weight:700">Chủ xị gánh lẻ +${esc(fmtVnd(result.hostCovers))}</div>`
            : '';
        detail = `<div style="border-top:2px dashed #1B1B1B;padding:8px 14px 12px;font-family:var(--font-mono);font-size:14px;display:flex;flex-direction:column;gap:4px">
          ${lines || '<div>Chưa có order</div>'}
          ${cover}
          <button type="button" class="hn-btn" data-recreate="${t.id}" style="align-self:flex-start;margin-top:6px;font-size:13px">KÊ LẠI BÀN NÀY</button>
        </div>`;
      }
      return `<li>
        <button type="button" class="hn-ledger-btn" data-expand="${t.id}" aria-expanded="${open}">
          <span style="font-family:var(--font-mono);font-weight:700;font-size:14px;background:#1B1B1B;color:#FFF4D6;padding:2px 8px">#${t.id}</span>
          <span style="font-family:var(--font-mono);font-weight:700;font-size:14px">${esc(formatDateChip(t.date))}</span>
          <span style="font-family:var(--font-display);font-size:17px;flex:1 1 200px;min-width:0">${esc(shop?.name || '—')}</span>
          <span style="font-size:14px;font-weight:700">${peopleCount(t)} người</span>
          <span style="font-family:var(--font-mono);font-weight:700;font-size:16px;min-width:6.5em;text-align:right">${esc(fmtVnd(total))}</span>
          <span style="transform:rotate(${open ? '90deg' : '0deg'});display:inline-flex">${ICONS.chevron}</span>
        </button>
        ${detail}
      </li>`;
    })
    .join('');

  return `<main class="hn-main"><ol class="hn-ledger">${rows || '<li class="hn-panel">Chưa có bàn</li>'}</ol></main>`;
}

export function bindSo(root: HTMLElement): void {
  root.querySelectorAll('[data-expand]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number((btn as HTMLElement).dataset.expand);
      patch((s) => {
        s.ui.expandedLedgerId = s.ui.expandedLedgerId === id ? null : id;
      });
    });
  });

  root.querySelectorAll('[data-recreate]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number((btn as HTMLElement).dataset.recreate);
      const t = state.tables.find((x) => x.id === id);
      if (!t) return;
      await cmd('table.create', { shopIds: [...t.shopIds] });
      toast('Đã kê lại bàn');
      setRoute('ban');
    });
  });
}
