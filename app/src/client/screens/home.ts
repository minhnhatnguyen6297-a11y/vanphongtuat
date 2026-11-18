import { esc } from '../../shared/esc.js';
import { canOpenQuyen } from '../store.js';
import type { RouteId } from '../store.js';
import { clearLoginHint, readLoginHint } from '../login-hint.js';
import { ROOM_ART } from '../ui/lobby-art.js';

type Room = {
  id: RouteId;
  name: string;
  sub: string;
  gated?: boolean;
};

const ROOMS: Room[] = [
  { id: 'ban', name: 'Bình chọn quán', sub: 'Chọn quán và gọi món' },
  { id: 'quay', name: 'Vòng quay', sub: 'Quay một danh sách' },
  { id: 'tien', name: 'Chia tiền', sub: 'Chia bill · VietQR' },
  { id: 'chat', name: 'Bể cá & chat', sub: 'Ao chung' },
  { id: 'so', name: 'Lịch sử bàn', sub: 'Các bàn đã kê' },
  { id: 'kho', name: 'Kho quán', sub: 'Quán ruột' },
  { id: 'sanh', name: 'Trò chơi', sub: 'Caro · Cá ngựa · Tỉ phú' },
  { id: 'quyen', name: 'Phân quyền', sub: 'Ma trận quyền', gated: true },
];

export function titleHome(): { chip: string; fun: string } {
  return { chip: 'VĂN PHÒNG TUẤT', fun: 'SẢNH' };
}

export function renderHome(): string {
  const hint = readLoginHint();
  const hintHtml = hint
    ? `<p class="hn-login-next" id="login-next" role="status">Đã vào sảnh. Lần sau đăng nhập bằng tên <strong>${esc(hint)}</strong> và PIN 6 số vừa tạo. <button type="button" class="hn-btn" id="login-next-dismiss">Đã hiểu</button></p>`
    : '';
  const rooms = ROOMS.filter((r) => !r.gated || canOpenQuyen()).map((r) => {
    const art = ROOM_ART[r.id] ?? '';
    return `<a class="hn-floor-room" href="#/${r.id}">
      <span class="hn-floor-room-art">${art}</span>
      <span class="hn-floor-room-name">${esc(r.name)}</span>
      <span class="hn-floor-room-sub">${esc(r.sub)}</span>
    </a>`;
  });

  return `<main class="hn-main">
    ${hintHtml}
    <div class="hn-floor" role="navigation" aria-label="Các phòng">
      ${rooms.join('')}
    </div>
  </main>`;
}

export function bindHome(root: HTMLElement): void {
  root.querySelector('#login-next-dismiss')?.addEventListener('click', () => {
    clearLoginHint();
    root.querySelector('#login-next')?.remove();
  });
}
