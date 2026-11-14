import { esc } from '../../shared/esc.js';
import {
  VUON_EXPRESSION_LABEL,
  VUON_SEASON_LABEL,
  VUON_STAGE_LABEL,
  VUON_STAGES,
  careOf,
  isNight,
  saigonDateString,
  seasonBackground,
  seasonFromDate,
  speciesById,
  speciesOf,
  spriteUrl,
  stageFromCareDays,
  type VuonCareResult,
  type VuonExpression,
  type VuonKind,
  type VuonRow,
  type VuonSeason,
  type VuonSpecies,
  type VuonStage,
} from '../../shared/vuon.js';
import { state } from '../store.js';
import { cmd } from '../ws.js';

type Mode = 'garden' | 'kho' | 'visit';

const view: {
  mode: Mode;
  khoKind: VuonKind;
  petId: string;
  plantId: string;
  khoIndex: number;
  ownerId: string | null;
  seasonPreview: VuonSeason | null;
  artPreview: { speciesId: string; stage: VuonStage } | null;
  expression: VuonExpression;
  expressionUntil: number;
  status: string;
  busy: boolean;
  focus: VuonKind;
} = {
  mode: 'garden',
  khoKind: 'pet',
  petId: sessionGet('hng.vuon.pet', 'meo'),
  plantId: sessionGet('hng.vuon.plant', 'sen'),
  khoIndex: 0,
  ownerId: null,
  seasonPreview: sessionSeason(),
  artPreview: null,
  expression: 'vui',
  expressionUntil: 0,
  status: 'Vườn đang yên.',
  busy: false,
  focus: 'pet',
};

let clock = 0;
let moodTimer = 0;
let motionBound = false;

function sessionGet(key: string, fallback: string): string {
  try {
    const v = sessionStorage.getItem(key);
    if (v && speciesById(v)) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function sessionSeason(): VuonSeason | null {
  try {
    const v = sessionStorage.getItem('hng.vuon.season');
    if (v === 'xuan' || v === 'ha' || v === 'thu' || v === 'dong') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function remember(): void {
  try {
    sessionStorage.setItem('hng.vuon.pet', view.petId);
    sessionStorage.setItem('hng.vuon.plant', view.plantId);
    if (view.seasonPreview) sessionStorage.setItem('hng.vuon.season', view.seasonPreview);
    else sessionStorage.removeItem('hng.vuon.season');
  } catch {
    /* ignore */
  }
}

export function titleVuon(): { chip: string; fun: string } {
  return { chip: 'VƯỜN', fun: 'NGỒI MỘT LÁT' };
}

const SEASONS: VuonSeason[] = ['xuan', 'ha', 'thu', 'dong'];

function seasonIcon(season: VuonSeason): string {
  if (season === 'xuan') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="#f4a3c2"/><path d="M12 2c1 3 1 4 0 6M12 22c-1-3-1-4 0-6M2 12c3-1 4-1 6 0M22 12c-3 1-4 1-6 0M5 5c2 2 3 2 4 3M19 19c-2-2-3-2-4-3M19 5c-2 2-2 3-3 4M5 19c2-2 2-3 3-4" stroke="#e4789a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
  }
  if (season === 'ha') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="#ffcf6b"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#e09a2e" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  }
  if (season === 'thu') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c2 4 1 6 4 8-3 0-4 2-4 5 0-3-1-5-4-5 3-2 2-4 4-8z" fill="#e07a3d"/><path d="M12 15v7" stroke="#8d4b22" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M12 12l8-4M12 12l8 4M12 12l-8-4M12 12l-8 4" stroke="#d7e7f5" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`;
}

function bowlIcon(): string {
  return `<svg viewBox="0 0 48 32" aria-hidden="true"><ellipse cx="24" cy="22" rx="16" ry="8" fill="#e8893a"/><path d="M10 18c0 8 6 12 14 12s14-4 14-12" fill="#f6c48a" stroke="#c56a22" stroke-width="2"/><circle cx="18" cy="14" r="3" fill="#f0a04a"/><circle cx="26" cy="12" r="3" fill="#f0a04a"/><circle cx="23" cy="17" r="2.4" fill="#e8893a"/><path d="M16 26c2 2 4 2 6 1 1 2 3 2 5 0" fill="#fff" opacity=".7"/></svg>`;
}

function canIcon(): string {
  return `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M14 14h16l2 14H12z" fill="#7ecfb8" stroke="#2f8f78" stroke-width="2"/><path d="M18 14c0-6 10-6 10 0" fill="none" stroke="#2f8f78" stroke-width="2"/><path d="M30 16h8l-2 6h-4" fill="#b7eadc" stroke="#2f8f78" stroke-width="2"/><path d="M10 22c-3 1-4 3-3 4" fill="none" stroke="#7ec8e8" stroke-width="2" stroke-linecap="round"/><path d="M8 26c-2 1-2 2-1 3" fill="none" stroke="#7ec8e8" stroke-width="2" stroke-linecap="round"/></svg>`;
}

export function renderVuon(): string {
  const seasons = SEASONS.map(
    (s) =>
      `<button type="button" data-season-pick="${s}" aria-label="${VUON_SEASON_LABEL[s]}">${seasonIcon(s)}<span>${VUON_SEASON_LABEL[s]}</span></button>`,
  ).join('');

  const stages = VUON_STAGES.map((stage, i) => {
    const arrow =
      i < VUON_STAGES.length - 1 ? `<span class="vuon-arrow" aria-hidden="true">→</span>` : '';
    return `<figure data-stage-pick="${stage}">
      <img alt="" data-stage-img="${stage}">
      <div class="vuon-todo" data-stage-todo="${stage}" hidden>Chưa có tranh</div>
      <figcaption>${VUON_STAGE_LABEL[stage]}</figcaption>
    </figure>${arrow}`;
  }).join('');

  return `<main class="vuon" data-vuon-root data-expression="vui">
    <div class="vuon-sky" data-vuon-sky></div>
    <div class="vuon-rays" aria-hidden="true"></div>
    <div class="vuon-fall" data-vuon-fall aria-hidden="true"></div>
    <div class="vuon-veil" aria-hidden="true"></div>
    <div class="vuon-shade" aria-hidden="true"></div>
    <header class="vuon-top">
      <div class="vuon-top-left">
        <button type="button" class="vuon-round" data-vuon-back aria-label="Quay lại">←</button>
        <div class="vuon-wood" data-vuon-wood hidden><span data-vuon-wood-title></span></div>
      </div>
      <div class="vuon-plaque" data-vuon-plaque>
        <b data-vuon-name></b>
        <span data-vuon-level></span>
        <span data-vuon-days></span>
        <span class="vuon-preview" data-vuon-preview hidden>Đang xem tranh</span>
      </div>
      <div class="vuon-seasons" role="group" aria-label="Mùa">${seasons}</div>
    </header>
    <p class="vuon-cal" data-vuon-cal></p>
    <div class="vuon-stage" data-vuon-stage>
      <div class="vuon-sprite" data-vuon-plant-slot>
        <span class="vuon-aura" aria-hidden="true"></span>
        <img alt="" data-vuon-plant-img>
        <div class="vuon-todo" data-vuon-plant-todo hidden>Chưa có tranh</div>
      </div>
      <button type="button" class="vuon-sprite" data-vuon-pet aria-label="Vuốt ve">
        <span class="vuon-aura" aria-hidden="true"></span>
        <img alt="" data-vuon-pet-img>
        <div class="vuon-todo" data-vuon-pet-todo hidden>Chưa có tranh</div>
        <i class="vuon-spark"></i><i class="vuon-spark"></i><i class="vuon-spark"></i>
      </button>
      <div class="vuon-rest" data-vuon-rest hidden>
        <img class="vuon-chibi" alt="" src="/art/vuon/prop/chibi.webp">
        <img alt="" src="/art/vuon/prop/meo-ngu.webp">
        <img alt="" src="/art/vuon/prop/tho-ngu.webp">
      </div>
      <figure class="vuon-mood">
        <img alt="" data-vuon-mood hidden>
        <figcaption data-vuon-mood-label></figcaption>
      </figure>
    </div>
    <p class="vuon-status" data-vuon-status role="status"></p>
    <div class="vuon-actions" data-vuon-actions>
      <button type="button" class="vuon-feed" data-vuon-feed>${bowlIcon()}<span>Cho ăn</span></button>
      <button type="button" class="vuon-water" data-vuon-water>${canIcon()}<span>Tưới cây</span></button>
    </div>
    <div class="vuon-links" data-vuon-links>
      <button type="button" data-vuon-open="pet">Kho thú cưng</button>
      <button type="button" data-vuon-open="plant">Kho cây trồng</button>
      <button type="button" data-vuon-open-visit>Ghé vườn</button>
    </div>
    <p class="vuon-visit-banner" data-vuon-visit-banner hidden>
      <span data-vuon-visit-name></span>
      <button type="button" data-vuon-home>Vườn mình</button>
    </p>
    <section class="vuon-kho" data-vuon-kho hidden>
      <button type="button" class="vuon-round vuon-prev" data-vuon-prev aria-label="Trước">‹</button>
      <div class="vuon-parchment">
        <p class="vuon-blurb" data-vuon-blurb></p>
        <div class="vuon-line">${stages}</div>
        <button type="button" class="vuon-kho-act" data-vuon-kho-act></button>
        <div class="vuon-dots" data-vuon-dots></div>
      </div>
      <button type="button" class="vuon-round vuon-next" data-vuon-next aria-label="Sau">›</button>
    </section>
    <section class="vuon-people" data-vuon-people hidden>
      <h2>Ghé vườn đồng nghiệp</h2>
      <p>Tưới giúp một cây. Không đua.</p>
      <div data-vuon-people-list></div>
    </section>
  </main>`;
}

function ownerId(): string {
  return view.ownerId || state.me?.id || '';
}

function heroSpecies(): VuonSpecies {
  if (view.mode === 'kho') {
    const list = speciesOf(view.khoKind);
    return list[view.khoIndex] || list[0]!;
  }
  if (view.artPreview) {
    const picked = speciesById(view.artPreview.speciesId);
    if (picked) return picked;
  }
  const id = view.focus === 'plant' ? view.plantId : view.petId;
  return speciesById(id) || speciesById('meo')!;
}

function setMood(expr: VuonExpression, ms: number): void {
  view.expression = expr;
  view.expressionUntil = Date.now() + ms;
  window.clearTimeout(moodTimer);
  moodTimer = window.setTimeout(() => {
    view.expressionUntil = 0;
    const live = document.querySelector('[data-vuon-root]');
    if (live) syncVuon(document);
  }, ms);
}

function moodNow(night: boolean, petRow: VuonRow): VuonExpression {
  if (view.expressionUntil > Date.now()) return view.expression;
  if (night) return 'buon_ngu';
  const today = saigonDateString(new Date());
  if (petRow.lastCareOn !== today) return 'doi_nhe';
  return 'vui';
}

function isCareResult(v: unknown): v is VuonCareResult {
  if (!v || typeof v !== 'object') return false;
  const o = v as VuonCareResult;
  return typeof o.careDays === 'number' && typeof o.speciesId === 'string' && typeof o.ownerId === 'string';
}

function upsert(row: VuonRow): void {
  const i = state.vuon.rows.findIndex((r) => r.memberId === row.memberId && r.speciesId === row.speciesId);
  if (i >= 0) state.vuon.rows[i] = row;
  else state.vuon.rows.push(row);
}

async function care(kind: VuonKind, speciesId: string): Promise<void> {
  if (view.busy) return;
  if (view.ownerId && kind === 'pet') {
    view.status = 'Chỉ tưới giúp cây thôi.';
    syncVuon(document);
    return;
  }
  const species = speciesById(speciesId);
  if (!species || species.kind !== kind) return;
  view.focus = kind;
  view.artPreview = null;
  if (kind === 'pet') view.petId = speciesId;
  else view.plantId = speciesId;
  view.busy = true;
  syncVuon(document);
  const args: { speciesId: string; ownerId?: string } = { speciesId };
  if (view.ownerId) args.ownerId = view.ownerId;
  const ack = await cmd('vuon.care', args);
  view.busy = false;
  if (!ack.ok || !isCareResult(ack.result)) {
    view.status = ack.error === 'forbidden' ? 'Chỉ tưới giúp cây thôi.' : 'Chưa chăm được, thử lại.';
    syncVuon(document);
    return;
  }
  const result = ack.result;
  upsert({
    memberId: result.ownerId,
    speciesId: result.speciesId,
    careDays: result.careDays,
    lastCareOn: result.lastCareOn,
  });
  if (result.counted && kind === 'pet') setMood('man_nguyen', 4200);
  view.status = result.counted
    ? kind === 'pet'
      ? 'Đã cho ăn. Mãn nguyện.'
      : 'Đã tưới. Cây mát rồi.'
    : kind === 'pet'
      ? 'Hôm nay đã no rồi.'
      : 'Hôm nay cây đã được tưới.';
  remember();
  syncVuon(document);
}

function paintSlot(
  slot: HTMLElement,
  img: HTMLImageElement,
  todo: HTMLElement,
  species: VuonSpecies,
  stage: VuonStage,
  giant: boolean,
): void {
  const url = spriteUrl(species, stage);
  const alt = `${species.names[stage]}, ${VUON_STAGE_LABEL[stage]}`;
  slot.dataset.temper = species.temper;
  slot.classList.toggle('is-giant', giant);
  slot.classList.toggle('is-non', stage === 'non');
  slot.classList.toggle('is-grown', stage === 'truong_thanh');
  img.alt = alt;
  if (!url) {
    img.hidden = true;
    img.removeAttribute('src');
    todo.hidden = false;
    return;
  }
  todo.hidden = true;
  img.hidden = false;
  if (img.getAttribute('src') !== url) img.src = url;
}

export function syncVuon(root: ParentNode): void {
  const el = root.querySelector?.('[data-vuon-root]') as HTMLElement | null;
  if (!el) return;

  if (!speciesById(view.petId)) view.petId = 'meo';
  if (!speciesById(view.plantId)) view.plantId = 'sen';
  const list = speciesOf(view.khoKind);
  if (view.khoIndex >= list.length) view.khoIndex = 0;

  const realSeason = seasonFromDate(new Date());
  const season = view.seasonPreview || realSeason;
  const night = isNight(new Date());
  const me = state.me?.id || '';
  const who = ownerId();
  const pet = speciesById(view.petId)!;
  const plant = speciesById(view.plantId)!;
  const hero = heroSpecies();
  const showPlant = view.mode === 'kho' ? hero.kind === 'plant' : true;
  const showPet = view.mode === 'kho' ? hero.kind === 'pet' : true;
  const petRow = careOf(state.vuon.rows, who, pet.id);
  const plantRow = careOf(state.vuon.rows, who, plant.id);
  const heroRow = careOf(state.vuon.rows, who, hero.id);
  const realStage = stageFromCareDays(heroRow.careDays);
  const preview = view.artPreview?.speciesId === hero.id ? view.artPreview.stage : null;
  const heroStage = preview || realStage;
  const petStage = hero.kind === 'pet' ? heroStage : stageFromCareDays(petRow.careDays);
  const plantStage = hero.kind === 'plant' ? heroStage : stageFromCareDays(plantRow.careDays);
  const petGiant = showPet && petStage === 'than_thoai';
  const plantGiant = showPlant && plantStage === 'than_thoai';
  const mood = moodNow(night, petRow);

  el.dataset.season = season;
  el.dataset.expression = mood;
  el.classList.toggle('is-night', night);
  el.classList.toggle('has-giant', petGiant || plantGiant);
  el.classList.toggle('both-giant', petGiant && plantGiant);
  el.classList.toggle('is-kho', view.mode !== 'garden');

  const sky = el.querySelector('[data-vuon-sky]') as HTMLElement;
  const bg = `url("${seasonBackground(season)}")`;
  if (sky.style.backgroundImage !== bg) sky.style.backgroundImage = bg;

  const plantSlot = el.querySelector('[data-vuon-plant-slot]') as HTMLElement;
  const petSlot = el.querySelector('[data-vuon-pet]') as HTMLElement;
  plantSlot.hidden = !showPlant;
  petSlot.hidden = !showPet;
  paintSlot(
    plantSlot,
    el.querySelector('[data-vuon-plant-img]') as HTMLImageElement,
    el.querySelector('[data-vuon-plant-todo]') as HTMLElement,
    plant,
    plantStage,
    plantGiant,
  );
  paintSlot(
    petSlot,
    el.querySelector('[data-vuon-pet-img]') as HTMLImageElement,
    el.querySelector('[data-vuon-pet-todo]') as HTMLElement,
    pet,
    petStage,
    petGiant,
  );
  plantSlot.classList.toggle('is-focus', view.focus === 'plant' || (view.mode === 'kho' && hero.kind === 'plant'));
  petSlot.classList.toggle('is-focus', view.focus === 'pet' || (view.mode === 'kho' && hero.kind === 'pet'));

  const rest = el.querySelector('[data-vuon-rest]') as HTMLElement;
  rest.hidden = !(petGiant || plantGiant);

  const moodLabel = el.querySelector('[data-vuon-mood-label]') as HTMLElement;
  moodLabel.textContent = showPet ? VUON_EXPRESSION_LABEL[mood] : '';

  const name = hero.names[realStage];
  (el.querySelector('[data-vuon-name]') as HTMLElement).textContent = name;
  (el.querySelector('[data-vuon-level]') as HTMLElement).textContent = `Cấp độ: ${VUON_STAGE_LABEL[realStage]}`;
  const days = heroRow.careDays;
  (el.querySelector('[data-vuon-days]') as HTMLElement).textContent =
    days === 0 ? 'Chưa có ngày chăm' : days === 1 ? '1 ngày chăm' : `${days} ngày chăm`;
  (el.querySelector('[data-vuon-preview]') as HTMLElement).hidden = !preview || preview === realStage;
  (el.querySelector('[data-vuon-status]') as HTMLElement).textContent = view.status;
  (el.querySelector('[data-vuon-cal]') as HTMLElement).textContent =
    view.seasonPreview && view.seasonPreview !== realSeason
      ? `Xem trước ${VUON_SEASON_LABEL[season]}`
      : `Theo lịch · ${VUON_SEASON_LABEL[realSeason]}`;

  el.querySelectorAll<HTMLButtonElement>('[data-season-pick]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.seasonPick === season));
  });

  const wood = el.querySelector('[data-vuon-wood]') as HTMLElement;
  const woodTitle = el.querySelector('[data-vuon-wood-title]') as HTMLElement;
  wood.hidden = view.mode !== 'kho';
  woodTitle.textContent = view.khoKind === 'pet' ? 'Kho thú cưng' : 'Kho cây trồng';

  const kho = el.querySelector('[data-vuon-kho]') as HTMLElement;
  const people = el.querySelector('[data-vuon-people]') as HTMLElement;
  const actions = el.querySelector('[data-vuon-actions]') as HTMLElement;
  const links = el.querySelector('[data-vuon-links]') as HTMLElement;
  kho.hidden = view.mode !== 'kho';
  people.hidden = view.mode !== 'visit';
  actions.hidden = view.mode !== 'garden';
  links.hidden = view.mode !== 'garden';

  const banner = el.querySelector('[data-vuon-visit-banner]') as HTMLElement;
  if (view.ownerId && view.ownerId !== me) {
    const person = state.members.find((m) => m.id === view.ownerId);
    banner.hidden = false;
    (el.querySelector('[data-vuon-visit-name]') as HTMLElement).textContent = person
      ? `Vườn của ${person.displayName}`
      : 'Vườn đồng nghiệp';
  } else {
    banner.hidden = true;
  }

  const feed = el.querySelector('[data-vuon-feed]') as HTMLButtonElement;
  const water = el.querySelector('[data-vuon-water]') as HTMLButtonElement;
  feed.disabled = view.busy || !!view.ownerId;
  water.disabled = view.busy;

  if (view.mode === 'kho') {
    (el.querySelector('[data-vuon-blurb]') as HTMLElement).textContent = hero.blurb;
    const act = el.querySelector('[data-vuon-kho-act]') as HTMLButtonElement;
    const visitingPet = !!view.ownerId && hero.kind === 'pet';
    act.textContent = hero.kind === 'pet' ? 'Cho ăn' : 'Tưới cây';
    act.classList.toggle('is-feed', hero.kind === 'pet');
    act.disabled = view.busy || visitingPet;
    act.dataset.kind = hero.kind;
    VUON_STAGES.forEach((stage) => {
      const fig = el.querySelector(`[data-stage-pick="${stage}"]`) as HTMLElement;
      const img = el.querySelector(`[data-stage-img="${stage}"]`) as HTMLImageElement;
      const todo = el.querySelector(`[data-stage-todo="${stage}"]`) as HTMLElement;
      const url = spriteUrl(hero, stage);
      fig.setAttribute('aria-current', stage === (preview || realStage) ? 'true' : 'false');
      img.alt = `${hero.names[stage]}, ${VUON_STAGE_LABEL[stage]}`;
      if (!url) {
        img.hidden = true;
        todo.hidden = false;
      } else {
        todo.hidden = true;
        img.hidden = false;
        if (img.getAttribute('src') !== url) img.src = url;
      }
    });
    const dots = el.querySelector('[data-vuon-dots]') as HTMLElement;
    const sig = list.map((s) => s.id).join(',');
    if (dots.dataset.sig !== sig) {
      dots.dataset.sig = sig;
      dots.innerHTML = list
        .map(
          (s, i) =>
            `<button type="button" data-vuon-dot="${i}" aria-label="${esc(s.names.truong_thanh)}"></button>`,
        )
        .join('');
    }
    dots.querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-current', String(i === view.khoIndex));
    });
  }

  if (view.mode === 'visit') {
    const host = el.querySelector('[data-vuon-people-list]') as HTMLElement;
    const others = state.members.filter((m) => m.id !== me && !m.disabled);
    const sig = others.map((m) => m.id).join(',');
    if (host.dataset.sig !== sig) {
      host.dataset.sig = sig;
      host.innerHTML = others.length
        ? others
            .map(
              (m) =>
                `<button type="button" data-visit="${esc(m.id)}">${esc(m.displayName)}</button>`,
            )
            .join('')
        : '<p>Chưa có đồng nghiệp.</p>';
    }
  }
}

function ensureFall(el: HTMLElement): void {
  const fall = el.querySelector('[data-vuon-fall]') as HTMLElement;
  if (fall.childElementCount) return;
  for (let i = 0; i < 16; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${(i * 6.1) % 100}%`;
    bit.style.animationDuration = `${9 + (i % 5) * 1.6}s`;
    bit.style.animationDelay = `${-i * 0.7}s`;
    fall.appendChild(bit);
  }
}

function onImgError(ev: Event): void {
  const img = ev.target as HTMLImageElement;
  if (!(img instanceof HTMLImageElement)) return;
  if (!img.getAttribute('src')) return;
  img.hidden = true;
  const todo = img.parentElement?.querySelector('.vuon-todo') as HTMLElement | null;
  if (todo) todo.hidden = false;
}

export function bindVuon(root: ParentNode): void {
  const el = root.querySelector('[data-vuon-root]') as HTMLElement | null;
  if (!el) return;
  ensureFall(el);
  if (!el.hasAttribute('data-wired')) {
    el.setAttribute('data-wired', '1');
    try {
      if (!sessionStorage.getItem('hng.vuon.greet')) {
        sessionStorage.setItem('hng.vuon.greet', '1');
        setMood('ngac_nhien', 2200);
      }
    } catch {
      /* ignore */
    }
    el.addEventListener('error', onImgError, true);
    el.addEventListener('click', (ev) => {
      const hit = (ev.target as HTMLElement).closest<HTMLElement>('[data-season-pick], [data-vuon-back], [data-vuon-feed], [data-vuon-water], [data-vuon-open], [data-vuon-open-visit], [data-vuon-home], [data-vuon-pet], [data-vuon-prev], [data-vuon-next], [data-vuon-dot], [data-stage-pick], [data-vuon-kho-act], [data-visit]');
      if (!hit) return;
      if (hit.dataset.seasonPick) {
        const pick = hit.dataset.seasonPick as VuonSeason;
        const real = seasonFromDate(new Date());
        view.seasonPreview = pick === real ? null : pick;
        view.status = view.seasonPreview ? `Xem trước ${VUON_SEASON_LABEL[pick]}.` : 'Theo lịch.';
        setMood('ngac_nhien', 1600);
        remember();
        syncVuon(document);
        return;
      }
      if (hit.hasAttribute('data-vuon-back')) {
        if (view.mode !== 'garden') {
          view.mode = 'garden';
          syncVuon(document);
        } else {
          location.hash = '#/sanh';
        }
        return;
      }
      if (hit.hasAttribute('data-vuon-feed')) {
        void care('pet', view.petId);
        return;
      }
      if (hit.hasAttribute('data-vuon-water')) {
        void care('plant', view.plantId);
        return;
      }
      if (hit.dataset.vuonOpen) {
        view.mode = 'kho';
        view.khoKind = hit.dataset.vuonOpen as VuonKind;
        const id = view.khoKind === 'pet' ? view.petId : view.plantId;
        const idx = speciesOf(view.khoKind).findIndex((s) => s.id === id);
        view.khoIndex = idx >= 0 ? idx : 0;
        view.artPreview = null;
        syncVuon(document);
        return;
      }
      if (hit.hasAttribute('data-vuon-open-visit')) {
        view.mode = 'visit';
        view.status = 'Tưới giúp một cây. Không cần cho ăn.';
        syncVuon(document);
        return;
      }
      if (hit.hasAttribute('data-vuon-home')) {
        view.ownerId = null;
        view.mode = 'garden';
        view.focus = 'pet';
        view.status = 'Vườn mình.';
        syncVuon(document);
        return;
      }
      if (hit.hasAttribute('data-vuon-pet')) {
        view.focus = 'pet';
        setMood('duoc_vuot_ve', 2500);
        view.status = 'Được vuốt ve.';
        syncVuon(document);
        return;
      }
      if (hit.hasAttribute('data-vuon-prev') || hit.hasAttribute('data-vuon-next')) {
        const list = speciesOf(view.khoKind);
        const dir = hit.hasAttribute('data-vuon-prev') ? -1 : 1;
        view.khoIndex = (view.khoIndex + dir + list.length) % list.length;
        view.artPreview = null;
        const chosen = list[view.khoIndex]!;
        if (chosen.kind === 'pet') view.petId = chosen.id;
        else view.plantId = chosen.id;
        view.focus = chosen.kind;
        remember();
        syncVuon(document);
        return;
      }
      if (hit.dataset.vuonDot) {
        view.khoIndex = Number(hit.dataset.vuonDot);
        view.artPreview = null;
        const chosen = speciesOf(view.khoKind)[view.khoIndex];
        if (chosen) {
          if (chosen.kind === 'pet') view.petId = chosen.id;
          else view.plantId = chosen.id;
          view.focus = chosen.kind;
        }
        remember();
        syncVuon(document);
        return;
      }
      if (hit.dataset.stagePick) {
        const chosen = speciesOf(view.khoKind)[view.khoIndex];
        if (chosen) {
          view.artPreview = { speciesId: chosen.id, stage: hit.dataset.stagePick as VuonStage };
          view.focus = chosen.kind;
          if (chosen.kind === 'pet') view.petId = chosen.id;
          else view.plantId = chosen.id;
        }
        view.status = 'Đang xem tranh. Cấp thật không đổi.';
        syncVuon(document);
        return;
      }
      if (hit.hasAttribute('data-vuon-kho-act')) {
        const chosen = speciesOf(view.khoKind)[view.khoIndex];
        if (chosen) void care(chosen.kind, chosen.id);
        return;
      }
      if (hit.dataset.visit) {
        view.ownerId = hit.dataset.visit;
        view.mode = 'garden';
        view.focus = 'plant';
        view.artPreview = null;
        view.status = 'Tưới giúp một cây.';
        syncVuon(document);
      }
    });
  }

  window.clearInterval(clock);
  clock = window.setInterval(() => {
    if (!el.isConnected) return;
    syncVuon(document);
  }, 30_000);

  if (!motionBound) {
    motionBound = true;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => document.documentElement.classList.toggle('vuon-reduce', mq.matches);
    apply();
    mq.addEventListener('change', apply);
  }

  syncVuon(root);
}
