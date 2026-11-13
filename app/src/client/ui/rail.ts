import { ICONS } from '../icons.js';
import type { RouteId } from '../store.js';
import { state } from '../store.js';

const ITEMS: { id: RouteId; label: string; icon: string }[] = [
  { id: 'ban', label: 'Bàn hôm nay', icon: ICONS.ban },
  { id: 'quay', label: 'Vòng quay', icon: ICONS.quay },
  { id: 'tien', label: 'Tính tiền', icon: ICONS.tien },
  { id: 'so', label: 'Sổ ghi', icon: ICONS.so },
  { id: 'kho', label: 'Kho quán', icon: ICONS.kho },
  { id: 'sanh', label: 'Sảnh', icon: ICONS.sanh },
];

export function renderRail(): string {
  const cur = state.route;
  return `<nav class="hn-rail" aria-label="Chuyển màn">
    ${ITEMS.map((it) => {
      const current = it.id === cur;
      return `<a href="#/${it.id}" ${current ? 'aria-current="page"' : ''} title="${it.label}">${it.icon}<span>${it.label}</span></a>`;
    }).join('')}
  </nav>`;
}
