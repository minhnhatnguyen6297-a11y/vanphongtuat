import { esc } from '../../shared/esc.js';
import { state, canOpenQuyen } from '../store.js';
import type { RouteId } from '../store.js';
import { clearLoginHint, readLoginHint } from '../login-hint.js';

/**
 * Hình thẻ là SVG nội tuyến, không ảnh mạng, không filter.
 * Cá quay đầu sang phải (đuôi trái) cho khớp quy ước bể.
 * Đổi hình ở ROOM_ART; đổi tên ở ROOMS.
 */
const ROOM_ART: Record<string, string> = {
  ban: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <ellipse cx="60" cy="30" rx="34" ry="10" fill="var(--highlight)" stroke="currentColor" stroke-width="3"/>
    <path d="M26 30h68l-8 26H34z" fill="var(--paper)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="48" cy="28" r="4" fill="var(--red)" stroke="currentColor" stroke-width="2"/>
    <circle cx="66" cy="26" r="3.5" fill="var(--green)" stroke="currentColor" stroke-width="2"/>
    <circle cx="78" cy="31" r="3" fill="var(--orange)" stroke="currentColor" stroke-width="2"/>
  </svg>`,
  quay: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <path d="M60 8l4 8h-8z" fill="var(--red)"/>
    <circle cx="60" cy="40" r="24" fill="var(--yellow)" stroke="currentColor" stroke-width="3"/>
    <path d="M60 16v48M36 40h48M43 23l34 34M77 23L43 57" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="60" cy="40" r="5" fill="var(--red)" stroke="currentColor" stroke-width="2"/>
  </svg>`,
  tien: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <rect x="30" y="42" width="62" height="16" rx="2" fill="var(--green)" stroke="currentColor" stroke-width="2"/>
    <rect x="24" y="30" width="62" height="16" rx="2" fill="var(--paper)" stroke="currentColor" stroke-width="2"/>
    <rect x="34" y="16" width="62" height="16" rx="2" fill="var(--yellow)" stroke="currentColor" stroke-width="2"/>
    <path d="M46 24h32M40 38h24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  so: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <path d="M28 14h44a6 6 0 0 1 6 6v38H34a6 6 0 0 1-6-6z" fill="var(--paper)" stroke="currentColor" stroke-width="3"/>
    <path d="M28 46a6 6 0 0 1 6-6h44" fill="none" stroke="currentColor" stroke-width="3"/>
    <path d="M40 26h28M40 34h20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  kho: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <path d="M24 32l36-16 36 16" fill="var(--red)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 32h56v26H32z" fill="var(--paper)" stroke="currentColor" stroke-width="3"/>
    <path d="M52 58V42h16v16" fill="var(--highlight)" stroke="currentColor" stroke-width="2"/>
  </svg>`,
  sanh: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <rect x="26" y="16" width="28" height="18" rx="2" fill="var(--yellow)" stroke="currentColor" stroke-width="2"/>
    <rect x="66" y="16" width="28" height="18" rx="2" fill="var(--red)" stroke="currentColor" stroke-width="2"/>
    <rect x="26" y="40" width="28" height="18" rx="2" fill="var(--green)" stroke="currentColor" stroke-width="2"/>
    <rect x="66" y="40" width="28" height="18" rx="2" fill="var(--paper)" stroke="currentColor" stroke-width="2"/>
    <path d="M74 49h12M80 43v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  chat: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M12 24h12l8-7v14l-8-7z" fill="var(--orange)"/>
      <ellipse cx="46" cy="24" rx="18" ry="10" fill="var(--orange)"/>
      <circle cx="56" cy="22" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M18 50h10l7-6v12l-7-6z" fill="var(--yellow)"/>
      <ellipse cx="48" cy="50" rx="15" ry="8" fill="var(--yellow)"/>
      <circle cx="56" cy="48" r="1.4" fill="currentColor" stroke="none"/>
      <path d="M62 36h10l7-6v12l-7-6z" fill="var(--blue)"/>
      <ellipse cx="92" cy="36" rx="15" ry="8" fill="var(--blue)"/>
      <circle cx="100" cy="34" r="1.4" fill="currentColor" stroke="none"/>
    </g>
  </svg>`,
  quyen: `<svg viewBox="0 0 120 72" aria-hidden="true">
    <g fill="currentColor">
      <ellipse cx="38" cy="28" rx="6" ry="8" transform="rotate(-25 38 28)"/>
      <ellipse cx="52" cy="20" rx="6" ry="8" transform="rotate(-8 52 20)"/>
      <ellipse cx="68" cy="20" rx="6" ry="8" transform="rotate(8 68 20)"/>
      <ellipse cx="82" cy="28" rx="6" ry="8" transform="rotate(25 82 28)"/>
      <path d="M60 34c-8 0-10 8-16 13-6 5-2 14 6 14 4 0 7-3 10-3s6 3 10 3c8 0 12-9 6-14-6-5-8-13-16-13z"/>
    </g>
  </svg>`,
};

type Room = {
  id: RouteId;
  name: string;
  sub: string;
  tone: 'red' | 'yellow' | 'blue' | 'green' | 'cream' | 'orange';
  gated?: boolean;
};

const ROOMS: Room[] = [
  { id: 'ban', name: 'Bình chọn', sub: 'Chọn quán và gọi món', tone: 'red' },
  { id: 'quay', name: 'Vòng quay', sub: 'Quay một danh sách', tone: 'yellow' },
  { id: 'tien', name: 'Chia tiền', sub: 'Chia bill · VietQR', tone: 'blue' },
  { id: 'chat', name: 'Bể cá', sub: 'Ao chung', tone: 'orange' },
  { id: 'kho', name: 'Kho quán', sub: 'Quán ruột', tone: 'orange' },
  { id: 'so', name: 'Sổ ghi', sub: 'Lịch sử bàn', tone: 'cream' },
  { id: 'sanh', name: 'Giải trí', sub: 'Caro · Cá ngựa · Tỉ phú', tone: 'green' },
  { id: 'quyen', name: 'Quyền', sub: 'Ma trận quyền', tone: 'cream', gated: true },
];

export function titleHome(): { chip: string; fun: string } {
  const name = state.me?.displayName?.split('(')[0]?.trim() || 'đồng nghiệp';
  return { chip: 'SẢNH VP', fun: `CHÀO ${name.toUpperCase()}!` };
}

export function renderHome(): string {
  const hint = readLoginHint();
  const hintHtml = hint
    ? `<p class="hn-login-next" id="login-next" role="status">Đã vào sảnh. Lần sau đăng nhập bằng tên <strong>${esc(hint)}</strong> và PIN 6 số vừa tạo. <button type="button" class="hn-btn" id="login-next-dismiss">Đã hiểu</button></p>`
    : '';
  const rooms = ROOMS.filter((r) => !r.gated || canOpenQuyen()).map((r) => {
    const art = ROOM_ART[r.id] ?? ROOM_ART.ban;
    return `<a class="hn-floor-room" href="#/${r.id}" data-tone="${r.tone}">
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
