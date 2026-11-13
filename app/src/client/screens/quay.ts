import { esc } from '../../shared/esc.js';
import { state, canPerm, setSound, memberById, shopById, notify } from '../store.js';
import type { Spin } from '../../shared/types.js';
import { ICONS, SHOP_COLORS } from '../icons.js';
import { cmd, setChatSubs, uuid } from '../ws.js';
import { toast } from '../ui/toast.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';

let audioCtx: AudioContext | null = null;
let lastTick = 0;
let animAngle = 0;
let spinRaf = 0;
let spinAnim: { id: string; from: number; to: number } | null = null;
let spinDoneTimer = 0;

function resumeAudio(): void {
  if (!audioCtx) audioCtx = new AudioContext();
  void audioCtx.resume();
}

function beep(freq: number, dur = 0.05, type: OscillatorType = 'square'): void {
  if (!state.ui.soundOn || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.04;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

type Seg = { start: number; end: number; mid: number; color: string; name: string };

function inkFor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#1B1B1B';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.55 ? '#1B1B1B' : '#FFF4D6';
}

/** Một nguồn góc cho conic / vạch / nhãn / đích quay (0° = đỉnh, theo chiều kim đồng hồ). */
function segmentLayout(items: { weight: number; name?: string }[]): Seg[] {
  const total = items.reduce((s, i) => s + i.weight, 0) || 1;
  let acc = 0;
  return items.map((it, i) => {
    const start = (acc / total) * 360;
    acc += it.weight;
    const end = (acc / total) * 360;
    return {
      start,
      end,
      mid: (start + end) / 2,
      color: SHOP_COLORS[i % SHOP_COLORS.length]!,
      name: it.name || '',
    };
  });
}

function conic(items: { weight: number }[]): string {
  const segs = segmentLayout(items);
  if (!segs.length) return 'conic-gradient(#FFF4D6, #FFF4D6)';
  // Hard color stops (no blend between wedges)
  const stops = segs
    .flatMap((s) => [`${s.color} ${s.start}deg`, `${s.color} ${s.end}deg`])
    .join(', ');
  return `conic-gradient(from -90deg, ${stops})`;
}

function landingAngle(resultIndex: number, items: { weight: number }[]): number {
  const segs = segmentLayout(items);
  const mid = segs[resultIndex]?.mid ?? 0;
  return (360 - mid + 360) % 360;
}

function spinAngle(resultIndex: number, items: { weight: number }[]): number {
  return 360 * 5 + landingAngle(resultIndex, items);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function stopSpinRaf(): void {
  if (spinRaf) {
    cancelAnimationFrame(spinRaf);
    spinRaf = 0;
  }
}

function ensureSpinAnim(spinning: Spin): { from: number; to: number } {
  const itemsSnap = JSON.parse(spinning.itemsJson) as { weight: number }[];
  const landing = landingAngle(spinning.resultIndex, itemsSnap);
  if (spinAnim && spinAnim.id === spinning.id) return spinAnim;
  const from = animAngle;
  let to = from + 360 * 5;
  const mod = ((to % 360) + 360) % 360;
  to += (landing - mod + 360) % 360;
  if (to - from < 360 * 4) to += 360;
  spinAnim = { id: spinning.id, from, to };
  return spinAnim;
}

function runSpinRaf(face: HTMLElement, spinning: Spin, reduced: boolean): void {
  stopSpinRaf();
  const anim = ensureSpinAnim(spinning);
  const start = spinning.startedAt;
  const dur = Math.max(1, reduced ? Math.min(spinning.durationMs, 600) : spinning.durationMs);
  face.style.transition = 'none';
  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / dur);
    const eased = reduced ? p : easeOutCubic(p);
    const angle = anim.from + (anim.to - anim.from) * eased;
    face.style.transform = `rotate(${angle}deg)`;
    face.style.setProperty('--wheel-angle', `${angle}deg`);
    animAngle = angle;
    if (p < 1) {
      spinRaf = requestAnimationFrame(tick);
      return;
    }
    spinRaf = 0;
    animAngle = anim.to;
    face.style.transform = `rotate(${anim.to}deg)`;
    face.style.setProperty('--wheel-angle', `${anim.to}deg`);
    if (!spinDoneTimer) {
      spinDoneTimer = window.setTimeout(() => {
        spinDoneTimer = 0;
        notify();
      }, 40);
    }
  };
  spinRaf = requestAnimationFrame(tick);
}

/** Slider % → weight, giữ tổng các ô khác. */
function weightFromPct(pct: number, itemWeight: number, totalW: number): number {
  const others = Math.max(0, totalW - itemWeight);
  if (others <= 0) return Math.max(1, itemWeight);
  const clamped = Math.max(1, Math.min(99, Math.round(pct)));
  return Math.max(1, Math.round((clamped / (100 - clamped)) * others));
}

function activeSpin(wheelId: string) {
  return state.spins.find((s) => s.wheelId === wheelId && Date.now() < s.startedAt + s.durationMs);
}

function latestSpin(wheelId: string) {
  return state.spins.find((s) => s.wheelId === wheelId);
}

function verdict(count: number): string {
  if (count <= 1) return 'Không cãi.';
  if (count === 2) return 'Quay lại lần 2. Cả bàn thấy hết.';
  return `Lần thứ ${count}. Có người chụp màn hình rồi.`;
}

function spinsToday(wheelId: string): number {
  const day = new Date().toDateString();
  return state.spins.filter(
    (s) => s.wheelId === wheelId && new Date(s.startedAt).toDateString() === day,
  ).length;
}

export function titleQuay(): { chip: string; fun: string } {
  return { chip: 'VÒNG QUAY', fun: 'QUAY XONG KHÔNG CÃI!' };
}

export function renderQuay(): string {
  const wheels = state.wheels;
  let wheel = wheels.find((w) => w.id === state.ui.wheelId) || wheels[0];
  if (wheel && state.ui.wheelId !== wheel.id) state.ui.wheelId = wheel.id;

  if (!wheel) {
    return `<main class="hn-main">${canPerm('wheel.create') ? `<button type="button" class="hn-btn" data-act="new-wheel">+ VÒNG MỚI</button>` : '<p>Chưa có vòng</p>'}</main>`;
  }

  const items = wheel.items;
  const spinning = activeSpin(wheel.id);
  const last = latestSpin(wheel.id);
  const layout = segmentLayout(items);

  let angle = animAngle;
  if (!spinning && last) {
    const itemsSnap = JSON.parse(last.itemsJson) as { weight: number }[];
    angle = spinAngle(last.resultIndex, itemsSnap);
    animAngle = angle;
  }

  const totalW = items.reduce((s, i) => s + i.weight, 0) || 1;
  const segs = layout.map((s, i) => {
    const ink = inkFor(s.color);
    return {
      sep: s.start - 90,
      rot: s.mid - 90,
      name: s.name || items[i]?.name || '',
      ink,
      span: Math.max(8, s.end - s.start),
    };
  });

  let spinLabel = 'QUAY NGAY';
  let disabled = false;
  if (!canPerm('wheel.spin')) {
    spinLabel = 'CHỈ XEM';
    disabled = true;
  } else if (items.length < 2) {
    spinLabel = 'THÊM ÍT NHẤT 2 Ô';
    disabled = true;
  } else if (spinning) {
    spinLabel = 'ĐANG QUAY…';
    disabled = true;
  } else if (last) {
    spinLabel = 'QUAY LẠI';
  }

  const hasWinner = !!(last && !spinning);
  const count = spinsToday(wheel.id);
  let act = '';
  if (hasWinner && wheel.kind === 'shop' && canPerm('table.setWinner')) {
    const item = items[last!.resultIndex];
    act = `<button type="button" class="hn-btn hn-btn-green" data-act="set-winner" data-shop="${item?.refShopId || ''}" data-spin="${last!.id}">CHỐT QUÁN NÀY</button>`;
  } else if (hasWinner && wheel.kind === 'person' && canPerm('table.setPickup')) {
    const item = JSON.parse(last!.itemsJson)[last!.resultIndex] as { refMemberId?: string };
    act = `<button type="button" class="hn-btn hn-btn-green" data-act="set-pickup" data-member="${item?.refMemberId || ''}" data-spin="${last!.id}">GHI NGƯỜI ĐI LẤY</button>`;
  }

  const canDelWheel = canPerm('wheel.delete');
  const chips = wheels
    .map((w) => {
      const on = w.id === wheel!.id;
      const del = canDelWheel
        ? `<button type="button" data-del-wheel="${w.id}" aria-label="Xóa vòng" title="Xóa vòng" style="margin-left:2px;width:28px;height:28px;border:2px solid #1B1B1B;background:#fff;cursor:pointer;font-weight:800;line-height:1">×</button>`
        : '';
      return `<span style="display:inline-flex;align-items:center">
        <button type="button" class="hn-choice" data-wheel="${w.id}" aria-pressed="${on}">${esc(w.title)}</button>${del}
      </span>`;
    })
    .join('');

  const rows = items
    .map((r, i) => {
      const pctNum = Math.max(1, Math.min(99, Math.round((r.weight / totalW) * 100)));
      const dot = SHOP_COLORS[i % SHOP_COLORS.length];
      return `<li class="hn-wheel-row">
        <span class="hn-wheel-swatch" aria-hidden="true" style="background:${dot}"></span>
        <input class="hn-input" data-iname="${r.id}" aria-label="Tên ô" value="${esc(r.name)}">
        <input type="range" min="1" max="99" value="${pctNum}" data-iw="${r.id}" data-iw-weight="${r.weight}" aria-label="Tỷ lệ %" style="accent-color:${dot}">
        <span class="hn-wheel-percent" data-pct-for="${r.id}">${pctNum}%</span>
        <button class="hn-wheel-remove" type="button" data-iremove="${r.id}" aria-label="Bỏ ô">${ICONS.x}</button>
      </li>`;
    })
    .join('');

  const log = state.spins
    .filter((s) => s.wheelId === wheel!.id)
    .slice(0, 5)
    .map((s) => {
      const d = new Date(s.startedAt);
      const when = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<div class="hn-wheel-log-row"><time>${when}</time><b>${esc(s.resultName)}</b></div>`;
    })
    .join('');

  const soundIcon = state.ui.soundOn ? ICONS.soundOn : ICONS.soundOff;

  return `<main class="hn-main">
    <div class="hn-wheel-chat">${renderChatPanel(`wheel:${wheel.id}`, { title: 'Chat vòng', collapsible: true })}</div>
    <div class="hn-quay-wrap">
      <section aria-label="Bàn xoay" class="hn-panel hn-paper-fold hn-wheel-stage">
        <button type="button" class="hn-btn hn-btn-white hn-wheel-sound" data-act="sound" aria-pressed="${state.ui.soundOn}" aria-label="${state.ui.soundOn ? 'Tắt tiếng' : 'Bật tiếng'}">${soundIcon} Âm thanh <span aria-hidden="true"></span></button>
        <div class="hn-wheel-play${hasWinner ? ' has-winner' : ''}">
        <div class="hn-wheel-controls">
        <div class="hn-wheel-disk">
          <div class="hn-pointer-outer" aria-hidden="true"></div>
          <div class="hn-pointer-inner" aria-hidden="true"></div>
          <div class="hn-wheel-face" id="wheel-face" style="background:${conic(items)};--wheel-angle:${angle}deg;transform:rotate(${angle}deg);transition:none">
            ${segs
              .map(
                (s) => `
              <div style="position:absolute;left:50%;top:50%;width:50%;height:3px;margin-top:-1.5px;background:#1B1B1B;transform-origin:0 50%;transform:rotate(${s.sep}deg);z-index:1"></div>
              <div class="hn-wheel-ray" style="--ray-angle:${s.rot}deg">
                <span class="hn-wheel-label" title="${esc(s.name)}" style="color:${s.ink};font-size:${s.span < 28 ? 11 : 13}px;max-width:${Math.min(110, s.span * 2.2)}px">${esc(s.name)}</span>
              </div>`,
              )
              .join('')}
          </div>
          <div class="hn-hub">${ICONS.paw}</div>
        </div>
        <button type="button" class="hn-btn hn-btn-red hn-wheel-spin" data-act="spin" data-cmd="wheel.spin" ${disabled ? 'disabled' : ''}>${ICONS.history}${spinLabel}</button>
        </div>
        ${
          hasWinner
            ? `<div role="status" class="hn-wheel-result">
          <span class="hn-wheel-stamp">TRỜI ĐÃ ĐỊNH</span>
          <div class="hn-wheel-verdict">
            <div class="hn-wheel-winner">${esc(last!.resultName)}</div>
            <div style="font-size:14px;color:#3D3D3D;margin-top:2px">${esc(verdict(count))}</div>
          </div>
          ${wheel.kind === 'shop' ? '<span class="hn-art-rice" aria-hidden="true"></span>' : ''}
          ${act}
        </div>`
            : ''
        }
        </div>
      </section>
      <section style="min-width:0">
        <div class="hn-panel hn-paper-fold hn-wheel-editor">
          <div class="hn-section-head"><h2 class="hn-h2"><span>CÁC Ô</span></h2></div>
          <div class="hn-wheel-picker">
            <div class="hn-wheel-tabs" role="group" aria-label="Chọn vòng quay">${chips}</div>
            ${canPerm('wheel.create') ? `<button type="button" class="hn-btn" data-act="new-wheel" style="font-size:12px;min-height:40px">+ VÒNG MỚI</button>` : ''}
          </div>
          <input class="hn-input" id="wheel-title" aria-label="Tên vòng" value="${esc(wheel.title)}" ${canPerm('wheel.edit') ? '' : 'readonly'}>
          <ul class="hn-wheel-items">${rows}</ul>
          ${
            canPerm('wheel.edit')
              ? `<div style="display:flex;gap:6px">
            <input class="hn-input" id="wheel-new" placeholder="Thêm ô…" style="flex:1">
            <button type="button" class="hn-btn hn-btn-green" data-act="add-item">THÊM</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button type="button" class="hn-btn" data-act="equal" style="min-height:40px;font-family:var(--font-body);font-weight:800;font-size:13px">Chia đều</button>
            ${wheel.kind === 'shop' ? `<button type="button" class="hn-btn hn-btn-white" data-act="by-vote" style="min-height:40px;font-size:13px">Theo vote</button>` : ''}
          </div>`
              : ''
          }
          ${
            log
              ? `<div class="hn-wheel-log">
            <h3>ĐÃ QUAY</h3>
            ${log}
          </div>`
              : ''
          }
        </div>
      </section>
    </div>
  </main>`;
}

export function bindQuay(root: HTMLElement): void {
  const wheel = state.wheels.find((w) => w.id === state.ui.wheelId) || state.wheels[0];
  if (wheel) setChatSubs([`wheel:${wheel.id}`]);
  else setChatSubs([]);
  bindChatPanel(root);

  const tabs = root.querySelector<HTMLElement>('.hn-wheel-tabs');
  const selectedTab = tabs?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (tabs && selectedTab?.parentElement) {
    const viewport = tabs.getBoundingClientRect();
    const tab = selectedTab.parentElement.getBoundingClientRect();
    if (tab.right > viewport.right) tabs.scrollLeft += tab.right - viewport.right + 3;
  }

  const face = root.querySelector('#wheel-face') as HTMLElement | null;
  const spinning = wheel ? activeSpin(wheel.id) : undefined;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (face && spinning) runSpinRaf(face, spinning, reduced);
  else stopSpinRaf();

  root.querySelector('[data-act="sound"]')?.addEventListener('click', () => {
    resumeAudio();
    setSound(!state.ui.soundOn);
  });

  root.querySelectorAll('[data-wheel]').forEach((b) => {
    b.addEventListener('click', () => {
      state.ui.wheelId = (b as HTMLElement).dataset.wheel!;
      notify();
    });
  });

  root.querySelectorAll('[data-del-wheel]').forEach((b) => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = (b as HTMLElement).dataset.delWheel!;
      if (!confirm('Xóa vòng này?')) return;
      const ack = await cmd('wheel.delete', { id });
      if (!ack.ok) {
        toast('Xóa lỗi');
        return;
      }
      if (state.ui.wheelId === id) {
        state.ui.wheelId = state.wheels.find((w) => w.id !== id)?.id || null;
      }
      toast('Đã xóa vòng');
    });
  });

  root.querySelector('[data-act="new-wheel"]')?.addEventListener('click', async () => {
    await cmd('wheel.create', { title: 'Vòng mới' });
  });

  root.querySelector('#wheel-title')?.addEventListener('change', async (e) => {
    if (!wheel) return;
    await cmd(
      'wheel.rename',
      { id: wheel.id, title: (e.target as HTMLInputElement).value },
      wheel.version,
    );
  });

  root.querySelectorAll('[data-iname]').forEach((el) => {
    el.addEventListener('change', async () => {
      await cmd(
        'wheel.item.update',
        { id: (el as HTMLElement).dataset.iname, name: (el as HTMLInputElement).value },
        wheel?.version,
      );
    });
  });

  root.querySelectorAll('[data-iw]').forEach((el) => {
    const input = el as HTMLInputElement;
    const id = input.dataset.iw!;
    input.addEventListener('input', () => {
      const label = root.querySelector(`[data-pct-for="${CSS.escape(id)}"]`);
      if (label) label.textContent = `${input.value}%`;
    });
    input.addEventListener('change', async () => {
      if (!wheel) return;
      const item = wheel.items.find((x) => x.id === id);
      if (!item) return;
      const total = wheel.items.reduce((s, i) => s + i.weight, 0) || 1;
      const weight = weightFromPct(Number(input.value), item.weight, total);
      await cmd('wheel.item.update', { id, weight }, wheel.version);
    });
  });

  root.querySelectorAll('[data-iremove]').forEach((el) => {
    el.addEventListener('click', async () => {
      await cmd('wheel.item.remove', { id: (el as HTMLElement).dataset.iremove });
    });
  });

  root.querySelector('[data-act="add-item"]')?.addEventListener('click', async () => {
    if (!wheel) return;
    const input = root.querySelector('#wheel-new') as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;
    await cmd('wheel.item.add', { wheelId: wheel.id, name, weight: 10 });
    input.value = '';
  });

  root.querySelector('[data-act="equal"]')?.addEventListener('click', async () => {
    if (!wheel) return;
    await cmd('wheel.equalize', { wheelId: wheel.id });
  });

  root.querySelector('[data-act="by-vote"]')?.addEventListener('click', async () => {
    if (!wheel) return;
    await cmd('wheel.byVote', { wheelId: wheel.id });
  });

  root.querySelector('[data-act="spin"]')?.addEventListener('click', async () => {
    if (!wheel || !canPerm('wheel.spin')) return;
    resumeAudio();
    lastTick = Date.now();
    const ack = await cmd('wheel.spin', { wheelId: wheel.id });
    if (!ack.ok) {
      if (ack.error === 'spinning') toast('Đang quay mà');
      else if (ack.error === 'forbidden') toast('Không được quay');
      return;
    }
    const res = ack.result as {
      spinId?: string;
      id?: string;
      wheelId: string;
      resultIndex: number;
      resultName: string;
      startedAt: number;
      durationMs: number;
      items?: unknown[];
    };
    // Live: đẩy spin vào state (snap wheels mang recentSpins nhưng có thể chậm)
    if (res && !state.mock) {
      const spin: Spin = {
        id: res.spinId || res.id || uuid(),
        wheelId: res.wheelId || wheel.id,
        byMember: state.me!.id,
        itemsJson: JSON.stringify(res.items || wheel.items),
        resultIndex: res.resultIndex,
        resultName: res.resultName,
        startedAt: res.startedAt,
        durationMs: res.durationMs,
      };
      if (!state.spins.some((s) => s.id === spin.id)) {
        state.spins.unshift(spin);
        notify();
      }
    }
    if (res && state.ui.soundOn) {
      const end = res.startedAt + res.durationMs;
      const tick = () => {
        if (Date.now() >= end) {
          beep(880, 0.15, 'sine');
          return;
        }
        if (Date.now() - lastTick > 80) {
          beep(420 + Math.random() * 80, 0.03);
          lastTick = Date.now();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  root.querySelector('[data-act="set-winner"]')?.addEventListener('click', async (e) => {
    const el = e.currentTarget as HTMLElement;
    const shopId = el.dataset.shop;
    if (!shopId) {
      // resolve from name
      const last = latestSpin(wheel!.id);
      const item = wheel!.items[last?.resultIndex ?? -1];
      await cmd('table.setWinner', {
        shopId: item?.refShopId || shopById(item?.refShopId || '')?.id,
        spinId: el.dataset.spin,
      });
    } else {
      await cmd('table.setWinner', { shopId, spinId: el.dataset.spin });
    }
    toast('Đã chốt quán');
  });

  root.querySelector('[data-act="set-pickup"]')?.addEventListener('click', async (e) => {
    const el = e.currentTarget as HTMLElement;
    let memberId = el.dataset.member;
    if (!memberId) {
      const last = latestSpin(wheel!.id);
      const snap = JSON.parse(last!.itemsJson) as { refMemberId?: string; name: string }[];
      const it = snap[last!.resultIndex];
      memberId = it?.refMemberId || memberById('')?.id;
      if (!memberId) {
        const m = state.members.find((x) => x.displayName === it?.name);
        memberId = m?.id;
      }
    }
    if (!memberId) return;
    await cmd('table.setPickup', { memberId, spinId: el.dataset.spin });
    toast('Đã ghi người đi lấy');
  });
}
