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

export function renderHeader(): string {
  const me = state.me;
  const tier = (me?.tier || (me?.isOperator ? 'chu_xi' : 'dan_den')) as Tier;
  const tierLabel = HEADER_TIER[tier] || TIER_LABELS[tier] || '';
  const hostNote = me && state.table?.hostId === me.id ? ' · Chủ xị bàn' : '';
  const label = me ? `${me.displayName}, ${tierLabel}${hostNote}` : 'Tài khoản';
  return `<header class="hn-head hn-head-bar">
    <a class="hn-logo" href="#/home">HÔM NAY ĂN GÌ</a>
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
  return `<section class="hn-title">
    ${showBack ? `<a class="hn-back-home" href="#/home" aria-label="Về sảnh">← SẢNH</a>` : ''}
    <span class="hn-chip">${esc(chip)}</span>
    <h1 class="hn-fun">${esc(fun)}</h1>
  </section>`;
}
