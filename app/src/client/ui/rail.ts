import { ICONS } from '../icons.js';
import type { RouteId } from '../store.js';
import { state } from '../store.js';

const ITEMS: { id: RouteId; label: string; icon: string; bill?: boolean }[] = [
  { id: 'ban', label: 'Bàn hôm nay', icon: ICONS.ban },
  { id: 'quay', label: 'Vòng quay', icon: ICONS.quay },
  { id: 'tien', label: 'Tính tiền', icon: ICONS.tien, bill: true },
  { id: 'so', label: 'Sổ ghi', icon: ICONS.so },
  { id: 'kho', label: 'Kho quán', icon: ICONS.kho },
  { id: 'sanh', label: 'Sảnh', icon: ICONS.sanh },
];

export function renderRail(): string {
  const cur = state.route;
  return `<nav class="hn-rail" aria-label="Chuyển màn">
    ${ITEMS.map((it) => {
      const current = it.id === cur;
      const cls = [it.bill ? 'hn-rail-bill' : ''].filter(Boolean).join(' ');
      return `<a href="#/${it.id}" class="${cls}" ${current ? 'aria-current="page"' : ''} aria-label="${it.label}" title="${it.label}">${it.icon}</a>`;
    }).join('')}
  </nav>`;
}
