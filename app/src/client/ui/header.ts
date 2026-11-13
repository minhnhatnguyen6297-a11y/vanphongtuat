import { esc } from '../../shared/esc.js';
import { TIER_LABELS, type Tier } from '../../shared/perms-catalog.js';
import { state } from '../store.js';
import { openAvatarModal } from './avatar.js';
import { renderFace } from './face.js';

const HEADER_TIER: Record<Tier, string> = {
  chu_xi: 'Chủ xị',
  pho_xi: 'Phó xị',
  dan_den: 'Dân đen',
  no_le: 'Nô lệ',
};

const TITLE_ART: Partial<Record<typeof state.route, string>> = {
  ban: '/art/table-title.png',
  quay: '/art/wheel-title.png',
  tien: '/art/bill-title.png',
};

export function renderHeader(): string {
  const me = state.me;
  const tier = (me?.tier || (me?.isOperator ? 'chu_xi' : 'dan_den')) as Tier;
  const tierLabel = HEADER_TIER[tier] || TIER_LABELS[tier] || '';
  const hostNote = me && state.table?.hostId === me.id ? ' · Chủ xị bàn' : '';
  const label = me ? `${me.displayName}, ${tierLabel}${hostNote}` : 'Tài khoản';
  return `<header class="hn-head hn-head-bar">
    <a class="hn-logo" href="#/home" aria-label="Văn phòng Tuất, Hôm nay ăn gì?">
      <img src="/art/brand-sticker.png" alt="" width="900" height="223">
    </a>
    ${
      me
        ? `<button type="button" class="hn-avatar-block" data-act="avatar" aria-label="${esc(label)}" title="${esc(label)}">
      ${renderFace({ avatarId: me.avatarId, displayName: me.displayName, size: 44 })}
      <span class="hn-avatar-meta">
        <span class="hn-avatar-name">${esc(me.displayName)}</span>
        <span class="hn-avatar-tier">${esc(tierLabel)}${esc(hostNote)}</span>
      </span>
    </button>`
        : `<button type="button" class="hn-avatar" data-act="avatar" aria-label="Tài khoản">?</button>`
    }
  </header>`;
}

export function bindHeader(root: HTMLElement): void {
  root.querySelector('[data-act="avatar"]')?.addEventListener('click', () => openAvatarModal());
}

export function renderTitle(chip: string, fun: string): string {
  const showBack = state.me && state.route !== 'home';
  const isWheel = state.route === 'quay';
  const art = TITLE_ART[state.route];
  return `<section class="hn-title${isWheel ? ' hn-title-wheel' : ''}">
    ${showBack ? `<a class="hn-back-home" href="#/home" aria-label="Về sảnh">← SẢNH</a>` : ''}
    <h1 class="hn-fun${art ? ' hn-fun-illustrated' : ''}">${art ? `<img src="${art}" alt="${esc(isWheel ? `${chip} · ${fun}` : fun)}">` : esc(fun)}</h1>
    <span class="hn-chip${isWheel ? ' sr-only' : ''}">${esc(chip)}</span>
  </section>`;
}
