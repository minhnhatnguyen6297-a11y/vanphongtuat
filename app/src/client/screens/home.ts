import { esc } from '../../shared/esc.js';
import { state, canOpenQuyen } from '../store.js';
import type { RouteId } from '../store.js';
import { ICONS } from '../icons.js';

type Room = {
  id: RouteId;
  name: string;
  sub: string;
  tone: 'red' | 'yellow' | 'blue' | 'green' | 'cream' | 'orange';
  area: string;
  gated?: boolean;
};

const ROOMS: Room[] = [
  { id: 'ban', name: 'PHÒNG ĂN TRƯA', sub: 'Vote · gọi món', tone: 'red', area: 'eat' },
  { id: 'quay', name: 'QUẦY VÒNG QUAY', sub: 'Quay xong không cãi', tone: 'yellow', area: 'wheel' },
  { id: 'tien', name: 'KÉT TIỀN', sub: 'Chia bill · VietQR', tone: 'blue', area: 'cash' },
  { id: 'so', name: 'SỔ BÀN GIẤY', sub: 'Lịch sử bàn', tone: 'cream', area: 'ledger' },
  { id: 'kho', name: 'KHO THỰC PHẨM', sub: 'Quán ruột', tone: 'orange', area: 'store' },
  { id: 'sanh', name: 'PHÒNG GIẢI TRÍ', sub: 'Caro · Cá ngựa · Tỉ phú', tone: 'green', area: 'game' },
  { id: 'chat', name: 'PHÒNG CHAT', sub: 'Chat tổng cả VP', tone: 'blue', area: 'chat' },
  { id: 'quyen', name: 'PHÒNG CHỦ XỊ', sub: 'Ma trận quyền', tone: 'cream', area: 'boss', gated: true },
];

export function titleHome(): { chip: string; fun: string } {
  const name = state.me?.displayName?.split('(')[0]?.trim() || 'đồng nghiệp';
  return { chip: 'SẢNH VP', fun: `CHÀO ${name.toUpperCase()}!` };
}

export function renderHome(): string {
  const rooms = ROOMS.filter((r) => !r.gated || canOpenQuyen()).map((r) => {
    const icon = r.id === 'quyen' ? ICONS.paw : (ICONS as Record<string, string>)[r.id] || ICONS.ban;
    return `<a class="hn-floor-room" href="#/${r.id}" data-area="${r.area}" data-tone="${r.tone}">
      <span class="hn-floor-room-icon">${icon}</span>
      <span class="hn-floor-room-name">${esc(r.name)}</span>
      <span class="hn-floor-room-sub">${esc(r.sub)}</span>
    </a>`;
  });

  return `<main class="hn-main">
    <div class="hn-floor" role="navigation" aria-label="Sơ đồ văn phòng">
      <div class="hn-floor-hall" aria-hidden="true">HÀNH LANG</div>
      ${rooms.join('')}
      <div class="hn-floor-plant" aria-hidden="true">${ICONS.paw}</div>
      <div class="hn-floor-door" aria-hidden="true">CỬA</div>
    </div>
  </main>`;
}

export function bindHome(_root: HTMLElement): void {
  /* links only */
}
