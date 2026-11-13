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
let spinEndTimer = 0;

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
  if (!segs.length) return 'var(--cream)';
  return `conic-gradient(${segs.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})`;
}

function spinAngle(resultIndex: number, items: { weight: number }[]): number {
  const segs = segmentLayout(items);
  const mid = segs[resultIndex]?.mid ?? 0;
  return 360 * 5 + (360 - mid);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function stopSpinRaf(): void {
  if (spinRaf) {
    cancelAnimationFrame(spinRaf);
    spinRaf = 0;
  }
  if (spinEndTimer) {
    window.clearTimeout(spinEndTimer);
    spinEndTimer = 0;
  }
}

function runSpinRaf(face: HTMLElement, spinning: Spin, reduced: boolean): void {
  stopSpinRaf();
  const itemsSnap = JSON.parse(spinning.itemsJson) as { weight: number }[];
  const target = spinAngle(spinning.resultIndex, itemsSnap);
  const start = spinning.startedAt;
  const dur = Math.max(1, reduced ? Math.min(spinning.durationMs, 600) : spinning.durationMs);
  face.style.transition = 'none';
  const tick = () => {
    if (!face.isConnected) return;
    const p = Math.max(0, Math.min(1, (Date.now() - start) / dur));
    const angle = target * (reduced ? p : easeOutCubic(p));
    face.style.transform = `rotate(${angle}deg)`;
    animAngle = angle;
    if (p < 1) spinRaf = requestAnimationFrame(tick);
    else {
      spinRaf = 0;
      animAngle = target;
      face.style.transform = `rotate(${target}deg)`;
      const remaining = Math.max(0, start + spinning.durationMs - Date.now());
      spinEndTimer = window.setTimeout(() => {
        spinEndTimer = 0;
        if (face.isConnected) notify();
      }, remaining + 1);
    }
  };
  spinRaf = requestAnimationFrame(tick);
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
    const ink = [0, 3, 4].includes(i % SHOP_COLORS.length) ? 'var(--ink)' : 'var(--paper)';
    return { sep: s.start - 90, rot: s.mid - 90, name: s.name || items[i]?.name || '', ink };
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
      const pct = Math.round((r.weight / totalW) * 100) + '%';
      const dot = SHOP_COLORS[i % SHOP_COLORS.length];
      return `<li class="hn-wheel-row">
        <span aria-hidden="true" style="flex:0 0 16px;height:16px;border-radius:50%;border:2px solid #1B1B1B;background:${dot}"></span>
        <input class="hn-input" data-iname="${r.id}" aria-label="Tên ô" value="${esc(r.name)}">
        <input type="range" min="1" max="100" value="${r.weight}" data-iw="${r.id}" aria-label="Trọng số ${esc(r.name)}" style="accent-color:${dot}">
        <span style="flex:0 0 40px;text-align:right;font-family:var(--font-mono);font-weight:700;font-size:14px">${pct}</span>
        <button type="button" data-iremove="${r.id}" aria-label="Bỏ ô" style="flex:0 0 40px;height:40px;background:#fff;border:2px solid #1B1B1B;cursor:pointer;display:flex;align-items:center;justify-content:center">${ICONS.x}</button>
      </li>`;
    })
    .join('');

  const log = state.spins
    .filter((s) => s.wheelId === wheel!.id)
    .slice(0, 5)
    .map((s) => {
      const d = new Date(s.startedAt);
      const when = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<div style="display:flex;gap:10px;font-size:14px"><span style="font-family:var(--font-mono);font-weight:700;flex:0 0 52px">${when}</span><b>${esc(s.resultName)}</b></div>`;
    })
    .join('');

  const soundIcon = state.ui.soundOn ? ICONS.soundOn : ICONS.soundOff;

  return `<main class="hn-main">
    <div class="hn-quay-wrap">
      <section aria-label="Bàn xoay" class="hn-panel hn-wheel-stage">
        <button type="button" class="hn-btn hn-btn-white hn-wheel-sound" data-act="sound" aria-pressed="${state.ui.soundOn}" aria-label="${state.ui.soundOn ? 'Tắt tiếng' : 'Bật tiếng'}" title="${state.ui.soundOn ? 'Tắt tiếng' : 'Bật tiếng'}">${soundIcon}</button>
        <div class="hn-wheel-play${hasWinner ? ' has-winner' : ''}">
        <div class="hn-wheel-controls">
        <div class="hn-wheel-disk">
          <div class="hn-pointer-outer" aria-hidden="true"></div>
          <div class="hn-pointer-inner" aria-hidden="true"></div>
          <div class="hn-wheel-face" id="wheel-face" style="background:${conic(items)};transform:rotate(${angle}deg);transition:none">
            ${segs
              .map(
                (s) => `
              <div style="position:absolute;left:50%;top:50%;width:50%;height:3px;margin-top:-1.5px;background:#1B1B1B;transform-origin:0 50%;transform:rotate(${s.sep}deg)"></div>
              <div style="position:absolute;left:50%;top:50%;width:50%;height:0;transform-origin:0 0;transform:rotate(${s.rot}deg)">
                <span style="position:absolute;right:22px;top:0;transform:translateY(-50%);max-width:62%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;font-size:14px;font-weight:800;color:${s.ink}">${esc(s.name)}</span>
              </div>`,
              )
              .join('')}
          </div>
          <div class="hn-hub">${ICONS.paw}</div>
        </div>
        <button type="button" class="hn-btn hn-btn-red hn-wheel-spin" data-act="spin" data-cmd="wheel.spin" ${disabled ? 'disabled' : ''}>${spinLabel}</button>
        </div>
        ${
          hasWinner
            ? `<div role="status" class="hn-wheel-result">
          <span class="hn-wheel-stamp">TRỜI ĐÃ ĐỊNH</span>
          <div style="margin-right:auto;min-width:0">
            <div style="font-family:var(--font-display);font-size:clamp(22px,2.6vw,30px);line-height:1.1">${esc(last!.resultName)}</div>
            <div style="font-size:14px;color:#3D3D3D;margin-top:2px">${esc(verdict(count))}</div>
          </div>
          ${act}
        </div>`
            : ''
        }
        </div>
        ${renderChatPanel(`wheel:${wheel.id}`, { title: 'CHAT VÒNG', collapsible: true })}
      </section>
      <section style="min-width:0">
        <div class="hn-panel hn-wheel-editor">
          <div class="hn-section-head"><h2 class="hn-h2">CÁC Ô</h2></div>
          <div class="hn-wheel-picker">
            <div class="hn-wheel-tabs" role="group" aria-label="Chọn vòng quay">${chips}</div>
            ${canPerm('wheel.create') ? `<button type="button" class="hn-btn" data-act="new-wheel" style="font-size:12px;min-height:40px">+ VÒNG MỚI</button>` : ''}
          </div>
          <input class="hn-input" id="wheel-title" value="${esc(wheel.title)}" ${canPerm('wheel.edit') ? '' : 'readonly'} style="font-family:var(--font-display);font-size:18px;background:transparent;border:0;border-bottom:3px solid #1B1B1B">
          <ul class="hn-wheel-items">${rows}</ul>
          ${
            canPerm('wheel.edit')
              ? `<div style="display:flex;gap:6px">
            <input class="hn-input" id="wheel-new" placeholder="Thêm ô…" style="flex:1">
            <button type="button" class="hn-btn hn-btn-ink" data-act="add-item" style="box-shadow:none">THÊM</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button type="button" class="hn-btn" data-act="equal" style="min-height:40px;font-family:var(--font-body);font-weight:800;font-size:13px">Chia đều</button>
            ${wheel.kind === 'shop' ? `<button type="button" class="hn-btn hn-btn-white" data-act="by-vote" style="min-height:40px;font-size:13px">Theo vote</button>` : ''}
          </div>`
              : ''
          }
          ${
            log
              ? `<div style="border-top:3px solid #1B1B1B;padding-top:8px;display:flex;flex-direction:column;gap:4px">
            <h3 style="margin:0;font-family:var(--font-display);font-weight:400;font-size:13px">ĐÃ QUAY</h3>
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
  if (tabs && selectedTab) {
    const viewport = tabs.getBoundingClientRect();
    const tab = selectedTab.parentElement!.getBoundingClientRect();
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
    el.addEventListener('change', async () => {
      await cmd(
        'wheel.item.update',
        { id: (el as HTMLElement).dataset.iw, weight: Number((el as HTMLInputElement).value) },
        wheel?.version,
      );
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
