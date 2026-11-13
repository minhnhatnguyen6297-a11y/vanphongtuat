import { avatarSvg } from '../../shared/avatars.js';
import { esc } from '../../shared/esc.js';

/** Khuôn mặt avatar (SVG) hoặc chữ cái dự phòng. */
export function renderFace(
  opts: { avatarId?: string | null; displayName?: string | null; size?: number; title?: string },
): string {
  const size = opts.size ?? 44;
  const title = opts.title || opts.displayName || '';
  const svg = avatarSvg(opts.avatarId);
  if (opts.avatarId) {
    return `<span class="hn-face-svg" style="width:${size}px;height:${size}px" title="${esc(title)}" aria-hidden="true">${svg}</span>`;
  }
  const initial = (opts.displayName || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="hn-face" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px" title="${esc(title)}">${esc(initial)}</span>`;
}
