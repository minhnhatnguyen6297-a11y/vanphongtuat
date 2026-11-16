import { join } from 'node:path';
import type { Db } from '../db.ts';
import { newId, nowIso } from '../db.ts';
import { APP_ROOT } from '../config.ts';
import { CmdError } from '../errors.ts';
import type { AuthMember } from '../perms.ts';
import type { CmdOk } from '../commands/types.ts';
import { idlePhase, idleTickMs, readIdleEnv, sanitizeIdle } from '../../shared/be/idle.ts';
import { writeFishPose, type Pose } from '../../shared/be/sim.ts';
import { validateStrokes } from '../../shared/be/strokes.ts';
import {
  BE_CAPS,
  FOOD_FALL_MS,
  RASTER_V,
  SPRITE_SIZE,
  UNLOCKS,
  growthScale,
  type BeDrawing,
  type BeFood,
  type BePublic,
  type BeSprite,
  type DrawingKind,
  type IdleConfig,
  type LightId,
  type SandId,
  type Stroke,
  type SwimType,
  type UnlockId,
} from '../../shared/be/types.ts';
import { BakeCache, sha20, type PackResult } from './cache.ts';

type DrawRow = {
  id: string;
  author_user_id: string;
  kind: string;
  name: string;
  strokes: string;
  stroke_hash: string;
  swim_type: string;
  wave: number;
  hidden: number;
  reported: number;
  scale: number;
  feeds: number;
  created_at: string;
  updated_at: string;
  x: number | null;
  y: number | null;
  phase: number | null;
  hold_x: number | null;
  hold_y: number | null;
  hold_until: number | null;
  released_at: string | null;
  author_name: string | null;
};

let current: BeRuntime | null = null;

export function setBeRuntime(runtime: BeRuntime | null) {
  current = runtime;
}

export function getBeRuntime(): BeRuntime | null {
  return current;
}

function isOwner(member: AuthMember): boolean {
  return member.isOperator || member.tier === 'chu_xi';
}

export class BeRuntime {
  readonly cache: BakeCache;
  private rev = 1;
  private timer: NodeJS.Timeout;
  private atlasTimer: NodeJS.Timeout | null = null;
  private pack: PackResult | null = null;
  private audience: (() => AuthMember[]) | null = null;
  private send: ((memberId: string, msg: unknown) => void) | null = null;
  private onKick: ((ids: string[]) => void) | null = null;
  private readonly idle: IdleConfig;
  private lastSave = new Map<string, number>();

  constructor(readonly db: Db, opts?: { cacheDir?: string; idle?: Partial<IdleConfig> }) {
    this.cache = new BakeCache(opts?.cacheDir ?? join(APP_ROOT, 'data', 'be-cache'));
    this.idle = opts?.idle ? sanitizeIdle({ ...readIdleEnv(), ...opts.idle }) : readIdleEnv();
    this.timer = setInterval(() => this.tick(), idleTickMs(this.idle));
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    if (this.atlasTimer) clearTimeout(this.atlasTimer);
    this.atlasTimer = null;
  }

  setAudience(fn: () => AuthMember[]) {
    this.audience = fn;
  }

  setSend(fn: (memberId: string, msg: unknown) => void) {
    this.send = fn;
  }

  setOnKick(fn: (ids: string[]) => void) {
    this.onKick = fn;
  }

  idleConfig(): IdleConfig {
    return this.idle;
  }

  touch(
    userId: string,
    opts: { active: boolean; hidden: boolean; create: boolean },
    now = Date.now(),
  ) {
    const row = this.db.prepare('SELECT user_id FROM be_session WHERE user_id = ?').get(userId) as
      | { user_id: string }
      | undefined;
    if (!row) {
      if (!opts.create) return;
      this.db
        .prepare('INSERT INTO be_session(user_id, last_active_at, hidden_at) VALUES(?,?,?)')
        .run(userId, now, opts.hidden ? now : null);
      return;
    }
    if (opts.hidden) {
      this.db
        .prepare('UPDATE be_session SET hidden_at = COALESCE(hidden_at, ?) WHERE user_id = ?')
        .run(now, userId);
      return;
    }
    if (opts.active) {
      this.db
        .prepare('UPDATE be_session SET last_active_at = ?, hidden_at = NULL WHERE user_id = ?')
        .run(now, userId);
    } else {
      this.db.prepare('UPDATE be_session SET hidden_at = NULL WHERE user_id = ?').run(userId);
    }
  }

  clearSession(userId: string) {
    this.db.prepare('DELETE FROM be_session WHERE user_id = ?').run(userId);
  }

  /** Đóng socket bất ngờ: bắt đầu đồng hồ tab ẩn, không tạo phiên mới. */
  markHiddenIfPresent(userId: string, now = Date.now()) {
    this.db
      .prepare('UPDATE be_session SET hidden_at = COALESCE(hidden_at, ?) WHERE user_id = ?')
      .run(now, userId);
  }

  sweep(now = Date.now()): string[] {
    const rows = this.db
      .prepare('SELECT user_id, last_active_at, hidden_at FROM be_session')
      .all() as { user_id: string; last_active_at: number; hidden_at: number | null }[];
    const kicked: string[] = [];
    for (const row of rows) {
      const phase = idlePhase({
        now,
        lastActiveAt: row.last_active_at,
        hiddenAt: row.hidden_at,
        ...this.idle,
      });
      if (phase.phase !== 'kick') continue;
      this.db.prepare('DELETE FROM be_session WHERE user_id = ?').run(row.user_id);
      kicked.push(row.user_id);
    }
    return kicked;
  }

  saveDrawing(member: AuthMember, args: Record<string, unknown>): CmdOk {
    const now = Date.now();
    const prev = this.lastSave.get(member.id) ?? 0;
    if (now - prev < 250) throw new CmdError('be_rate');
    const checked = validateStrokes(args.strokes);
    if (!checked.ok) throw new CmdError('be_strokes');
    const kind = args.kind as DrawingKind;
    const name = String(args.name);
    const swim = (args.swim as SwimType) || 'thuong';
    const wave = typeof args.wave === 'boolean' ? args.wave : kind === 'ca';
    const id = typeof args.id === 'string' ? args.id : newId();
    const hash = sha20(`${RASTER_V}|${kind}|${checked.json}`);
    this.cache.ensureSprite(hash, kind, checked.strokes);

    const existing = this.db
      .prepare('SELECT author_user_id, kind FROM be_drawing WHERE id = ?')
      .get(id) as { author_user_id: string; kind: string } | undefined;
    if (existing && existing.author_user_id !== member.id) throw new CmdError('forbidden');
    if (existing && existing.kind !== kind) throw new CmdError('be_strokes');
    if (!existing && kind === 'thuc_an' && this.countKind('thuc_an') >= BE_CAPS.thuc_an) {
      throw new CmdError('be_full');
    }
    const ts = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE be_drawing
           SET name = ?, strokes = ?, stroke_hash = ?, swim_type = ?, wave = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(name, checked.json, hash, swim, wave ? 1 : 0, ts, id);
    } else {
      this.db
        .prepare(
          `INSERT INTO be_drawing(
             id, author_user_id, kind, name, strokes, stroke_hash, swim_type, wave, hidden, reported, scale, feeds, created_at, updated_at
           ) VALUES(?,?,?,?,?,?,?,?,0,0,?,0,?,?)`,
        )
        .run(id, member.id, kind, name, checked.json, hash, swim, wave ? 1 : 0, growthScale(0), ts, ts);
    }
    this.lastSave.set(member.id, now);
    const placed = this.db.prepare('SELECT 1 AS ok FROM be_placement WHERE drawing_id = ?').get(id);
    this.bump(!!placed);
    return { result: { id }, scopes: [] };
  }

  release(member: AuthMember, args: Record<string, unknown>): CmdOk {
    const id = String(args.id);
    const row = this.db.prepare('SELECT * FROM be_drawing WHERE id = ?').get(id) as
      | { id: string; author_user_id: string; kind: string; hidden: number; stroke_hash: string }
      | undefined;
    if (!row || row.hidden) throw new CmdError('not_found');
    if (row.author_user_id !== member.id) throw new CmdError('forbidden');
    if (row.kind === 'thuc_an') {
      this.dropPellet(member.id, row.stroke_hash);
      this.bump(false);
      return { result: { id }, scopes: [] };
    }
    const already = this.db.prepare('SELECT 1 AS ok FROM be_placement WHERE drawing_id = ?').get(id);
    if (already) return { result: { id, placed: true }, scopes: [] };
    const kind = row.kind as DrawingKind;
    if (this.countPlaced(kind) >= BE_CAPS[kind]) throw new CmdError('be_full');
    const n = this.countPlaced(kind);
    const x = typeof args.x === 'number' ? args.x : 0.12 + ((n * 0.17) % 0.76);
    const y = typeof args.y === 'number' ? args.y : kind === 'ca' ? 0.5 : 0.78;
    this.db
      .prepare(
        `INSERT INTO be_placement(drawing_id, x, y, z, phase, hold_x, hold_y, hold_until, released_at)
         VALUES(?,?,?,?,?,NULL,NULL,NULL,?)`,
      )
      .run(id, x, y, n, Math.random(), nowIso());
    this.bump(true);
    return { result: { id }, scopes: [] };
  }

  feed(member: AuthMember): CmdOk {
    this.dropPellet(member.id, this.latestFoodHash());
    this.bump(false);
    return { result: { ok: true }, scopes: [] };
  }

  clean(member: AuthMember): CmdOk {
    const tank = this.tankRow();
    const gain = tank.dirt > 0.04 ? 2 : 0;
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE be_tank SET dirt = MAX(0, dirt - 0.55), updated_at = ?, updated_by = ? WHERE id = 'main'`,
      )
      .run(ts, member.id);
    this.db.prepare('DELETE FROM be_food').run();
    if (gain) this.addScales(member.id, gain);
    this.bump(false);
    return { result: { scales: gain }, scopes: [] };
  }

  tweak(member: AuthMember, args: Record<string, unknown>): CmdOk {
    const tank = this.tankRow();
    const sand = (args.sand as SandId) || tank.sand;
    const lighting = (args.lighting as LightId) || tank.lighting;
    const water = typeof args.waterLevel === 'number' ? args.waterLevel : tank.water_level;
    const rocks = typeof args.rockCount === 'number' ? args.rockCount : tank.rock_count;
    const wood = typeof args.woodCount === 'number' ? args.woodCount : tank.wood_count;
    this.db
      .prepare(
        `UPDATE be_tank
         SET sand = ?, lighting = ?, water_level = ?, rock_count = ?, wood_count = ?, updated_at = ?, updated_by = ?
         WHERE id = 'main'`,
      )
      .run(sand, lighting, water, rocks, wood, nowIso(), member.id);
    this.bump(false);
    return { result: { ok: true }, scopes: [] };
  }

  move(_member: AuthMember, args: Record<string, unknown>): CmdOk {
    const id = String(args.id);
    const row = this.db.prepare('SELECT drawing_id FROM be_placement WHERE drawing_id = ?').get(id);
    if (!row) throw new CmdError('not_found');
    const x = Number(args.x);
    const y = Number(args.y);
    this.db
      .prepare(
        `UPDATE be_placement SET x = ?, y = ?, hold_x = ?, hold_y = ?, hold_until = ? WHERE drawing_id = ?`,
      )
      .run(x, y, x, y, Date.now() + 8000, id);
    this.bump(false);
    return { result: { id }, scopes: [] };
  }

  rename(member: AuthMember, args: Record<string, unknown>): CmdOk {
    const id = String(args.id);
    const row = this.db.prepare('SELECT author_user_id FROM be_drawing WHERE id = ?').get(id) as
      | { author_user_id: string }
      | undefined;
    if (!row) throw new CmdError('not_found');
    if (row.author_user_id !== member.id) throw new CmdError('forbidden');
    this.db.prepare('UPDATE be_drawing SET name = ?, updated_at = ? WHERE id = ?').run(String(args.name), nowIso(), id);
    this.bump(false);
    return { result: { id }, scopes: [] };
  }

  hide(member: AuthMember, args: Record<string, unknown>): CmdOk {
    if (!isOwner(member)) throw new CmdError('forbidden');
    const id = String(args.id);
    const row = this.db.prepare('SELECT id FROM be_drawing WHERE id = ?').get(id);
    if (!row) throw new CmdError('not_found');
    this.db.prepare('UPDATE be_drawing SET hidden = 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
    this.db.prepare('DELETE FROM be_placement WHERE drawing_id = ?').run(id);
    this.bump(true);
    return { result: { id }, scopes: [] };
  }

  report(_member: AuthMember, args: Record<string, unknown>): CmdOk {
    const id = String(args.id);
    const row = this.db.prepare('SELECT id FROM be_drawing WHERE id = ? AND hidden = 0').get(id);
    if (!row) throw new CmdError('not_found');
    this.db.prepare('UPDATE be_drawing SET reported = 1 WHERE id = ?').run(id);
    this.bump(false);
    return { result: { id }, scopes: [] };
  }

  unlock(member: AuthMember, args: Record<string, unknown>): CmdOk {
    const item = String(args.item) as UnlockId;
    const spec = UNLOCKS[item];
    if (!spec) throw new CmdError('invalid_args');
    const have = this.db
      .prepare('SELECT 1 AS ok FROM be_unlock WHERE user_id = ? AND item = ?')
      .get(member.id, item);
    if (have) return { result: { item, already: true }, scopes: [] };
    if (this.scalesOf(member.id) < spec.cost) throw new CmdError('be_scales');
    this.db.prepare('UPDATE be_wallet SET scales = scales - ? WHERE user_id = ?').run(spec.cost, member.id);
    this.db.prepare('INSERT INTO be_unlock(user_id, item) VALUES(?, ?)').run(member.id, item);
    this.bump(false);
    return { result: { item }, scopes: [] };
  }

  getDrawing(member: AuthMember, args: Record<string, unknown>): CmdOk {
    const id = String(args.id);
    const row = this.db
      .prepare(
        'SELECT author_user_id, kind, name, strokes, swim_type, wave, hidden FROM be_drawing WHERE id = ?',
      )
      .get(id) as
      | {
          author_user_id: string;
          kind: string;
          name: string;
          strokes: string;
          swim_type: string;
          wave: number;
          hidden: number;
        }
      | undefined;
    if (!row) throw new CmdError('not_found');
    if (row.author_user_id !== member.id && !isOwner(member)) throw new CmdError('forbidden');
    return {
      result: {
        id,
        kind: row.kind,
        name: row.name,
        strokes: JSON.parse(row.strokes) as Stroke[],
        swim: row.swim_type,
        wave: !!row.wave,
        hidden: !!row.hidden,
      },
      scopes: [],
    };
  }

  rebuildAtlasSync() {
    if (this.atlasTimer) clearTimeout(this.atlasTimer);
    this.atlasTimer = null;
    this.rebuildAtlas();
  }

  push() {
    const members = this.audience?.() ?? [];
    const seen = new Set<string>();
    for (const member of members) {
      if (seen.has(member.id)) continue;
      seen.add(member.id);
      this.pushOne(member);
    }
  }

  pushOne(member: AuthMember) {
    this.send?.(member.id, { t: 'be:state', state: this.publicState(member) });
  }

  publicState(member: AuthMember): BePublic {
    const owner = isOwner(member);
    const drawings: BeDrawing[] = [];
    for (const row of this.rows()) {
      const mine = row.author_user_id === member.id;
      const placed = row.released_at != null;
      if (row.hidden && !mine && !owner) continue;
      if (!placed && !mine) continue;
      this.warm(row);
      drawings.push(this.toDrawing(row, owner));
    }
    const foods = this.foods(drawings);
    const layers = this.cache.scenes();
    const scene: BePublic['scene'] = {};
    for (const [name, info] of Object.entries(layers)) {
      scene[name] = {
        url: `/be/s/${info.hash}.png`,
        w: info.w,
        h: info.h,
        ...(info.frames ? { frames: info.frames, fw: info.fw, fh: info.fh } : {}),
      };
    }
    const tank = this.tankRow();
    return {
      rev: this.rev,
      now: Date.now(),
      idle: this.idle,
      tank: {
        sand: tank.sand as SandId,
        lighting: tank.lighting as LightId,
        waterLevel: tank.water_level,
        rockCount: tank.rock_count,
        woodCount: tank.wood_count,
        dirt: tank.dirt,
      },
      drawings,
      foods,
      wallet: { scales: this.scalesOf(member.id), unlocks: this.unlocksOf(member.id) },
      atlases: (this.pack?.atlases ?? []).map((a) => ({
        url: `/be/a/${a.hash}.png`,
        w: a.w,
        h: a.h,
      })),
      scene,
    };
  }

  png(hash: string): Buffer | null {
    if (!/^[a-f0-9]{16,64}$/.test(hash)) return null;
    return this.cache.pngOf(hash);
  }

  stats() {
    const cpu = process.cpuUsage();
    const mem = process.memoryUsage();
    return {
      rasterCount: this.cache.rasterCount,
      hitCount: this.cache.hitCount,
      atlasEncodes: this.cache.atlasEncodes,
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      cpuUserUs: cpu.user,
      cpuSystemUs: cpu.system,
    };
  }

  private tick() {
    let ids: string[] = [];
    try {
      ids = this.sweep();
    } catch (err) {
      console.error('be sweep', err);
      return;
    }
    if (ids.length) this.onKick?.(ids);
  }

  private bump(atlas: boolean) {
    this.rev++;
    if (atlas) this.scheduleAtlas();
  }

  private scheduleAtlas() {
    if (this.atlasTimer) return;
    this.atlasTimer = setTimeout(() => {
      this.atlasTimer = null;
      try {
        if (this.rebuildAtlas()) this.push();
      } catch (err) {
        console.error('be atlas', err);
      }
    }, 280);
    this.atlasTimer.unref?.();
  }

  private rebuildAtlas(): boolean {
    const rows = this.db
      .prepare(
        `SELECT d.id, d.stroke_hash AS hash
         FROM be_drawing d
         JOIN be_placement p ON p.drawing_id = d.id
         WHERE d.hidden = 0`,
      )
      .all() as { id: string; hash: string }[];
    const pack = this.cache.pack(rows);
    const changed = !this.pack || this.pack.key !== pack.key;
    this.pack = pack;
    return changed;
  }

  private dropPellet(memberId: string, spriteHash: string | null) {
    const now = Date.now();
    this.db.prepare('DELETE FROM be_food WHERE born_at < ?').run(now - 30_000);
    const active = this.db
      .prepare('SELECT COUNT(*) AS c FROM be_food WHERE eaten_at IS NULL OR eaten_at > ?')
      .get(now) as { c: number };
    if (active.c >= 3) throw new CmdError('be_food');
    const tank = this.tankRow();
    if (tank.dirt >= 0.9) throw new CmdError('be_dirty');
    const x = 0.18 + Math.random() * 0.64;
    const fish = this.rows().filter((r) => r.kind === 'ca' && r.released_at && !r.hidden);
    let eater: string | null = null;
    let eatenAt: number | null = null;
    if (fish.length) {
      let best = fish[0];
      let bestD = 99;
      const pose: Pose = { x: 0, y: 0, facing: 1, bend: 0 };
      for (const f of fish) {
        writeFishPose(
          {
            id: f.id,
            swim: (f.swim_type as SwimType) || 'thuong',
            phase: f.phase ?? 0,
            holdX: f.hold_x,
            holdY: f.hold_y,
            holdUntil: f.hold_until,
          },
          [],
          now,
          tank.water_level,
          pose,
        );
        const d = Math.abs(pose.x - x);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      eater = best.id;
      eatenAt = now + FOOD_FALL_MS;
      const feeds = best.feeds + 1;
      this.db
        .prepare('UPDATE be_drawing SET feeds = ?, scale = ?, updated_at = ? WHERE id = ?')
        .run(feeds, growthScale(feeds), nowIso(), eater);
    }
    this.db
      .prepare(
        `INSERT INTO be_food(id, x, y, born_at, eater_id, eaten_at, sprite_hash) VALUES(?,?,?,?,?,?,?)`,
      )
      .run(newId(), x, 0.8, now, eater, eatenAt, spriteHash);
    this.db
      .prepare(
        `UPDATE be_tank SET dirt = MIN(1, dirt + 0.1), updated_at = ?, updated_by = ? WHERE id = 'main'`,
      )
      .run(nowIso(), memberId);
    this.addScales(memberId, 1);
  }

  private latestFoodHash(): string | null {
    const row = this.db
      .prepare(
        `SELECT stroke_hash FROM be_drawing
         WHERE kind = 'thuc_an' AND hidden = 0
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get() as { stroke_hash: string } | undefined;
    return row?.stroke_hash ?? null;
  }

  private addScales(userId: string, n: number) {
    this.db
      .prepare(
        `INSERT INTO be_wallet(user_id, scales) VALUES(?, ?)
         ON CONFLICT(user_id) DO UPDATE SET scales = scales + excluded.scales`,
      )
      .run(userId, n);
  }

  private scalesOf(userId: string): number {
    const row = this.db.prepare('SELECT scales FROM be_wallet WHERE user_id = ?').get(userId) as
      | { scales: number }
      | undefined;
    return row?.scales ?? 0;
  }

  private unlocksOf(userId: string): string[] {
    return (
      this.db.prepare('SELECT item FROM be_unlock WHERE user_id = ?').all(userId) as { item: string }[]
    ).map((r) => r.item);
  }

  private countKind(kind: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM be_drawing WHERE kind = ? AND hidden = 0')
      .get(kind) as { c: number };
    return row.c;
  }

  private countPlaced(kind: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM be_drawing d
         JOIN be_placement p ON p.drawing_id = d.id
         WHERE d.kind = ? AND d.hidden = 0`,
      )
      .get(kind) as { c: number };
    return row.c;
  }

  private tankRow() {
    return this.db.prepare(`SELECT * FROM be_tank WHERE id = 'main'`).get() as {
      sand: string;
      lighting: string;
      water_level: number;
      rock_count: number;
      wood_count: number;
      dirt: number;
    };
  }

  private rows(): DrawRow[] {
    return this.db
      .prepare(
        `SELECT d.*, p.x AS x, p.y AS y, p.phase AS phase, p.hold_x AS hold_x, p.hold_y AS hold_y,
                p.hold_until AS hold_until, p.released_at AS released_at, m.display_name AS author_name
         FROM be_drawing d
         LEFT JOIN be_placement p ON p.drawing_id = d.id
         LEFT JOIN members m ON m.id = d.author_user_id
         ORDER BY d.created_at ASC`,
      )
      .all() as DrawRow[];
  }

  private warm(row: DrawRow) {
    if (this.cache.pngOf(row.stroke_hash)) return;
    let strokes: Stroke[] = [];
    try {
      strokes = JSON.parse(row.strokes) as Stroke[];
    } catch {
      return;
    }
    this.cache.ensureSprite(row.stroke_hash, row.kind as DrawingKind, strokes);
  }

  private toDrawing(row: DrawRow, owner: boolean): BeDrawing {
    const kind = row.kind as DrawingKind;
    const size = SPRITE_SIZE[kind];
    const frame = this.pack?.frames[row.id];
    const sprite: BeSprite = {
      hash: row.stroke_hash,
      url: `/be/g/${row.stroke_hash}.png`,
      w: frame?.w ?? size.w,
      h: frame?.h ?? size.h,
      atlas: frame ? frame.atlas : null,
      ax: frame?.x ?? 0,
      ay: frame?.y ?? 0,
    };
    return {
      id: row.id,
      authorId: row.author_user_id,
      authorName: row.author_name || '?',
      kind,
      name: row.name,
      swim: (row.swim_type as SwimType) || 'thuong',
      wave: !!row.wave,
      hidden: !!row.hidden,
      reported: owner ? !!row.reported : false,
      scale: row.scale,
      feeds: row.feeds,
      placed: row.released_at != null,
      x: row.x ?? 0.5,
      y: row.y ?? 0.5,
      phase: row.phase ?? 0,
      holdX: row.hold_x,
      holdY: row.hold_y,
      holdUntil: row.hold_until,
      releasedAt: row.released_at ? Date.parse(row.released_at) : null,
      createdAt: row.created_at,
      sprite,
    };
  }

  private foods(_drawings: BeDrawing[]): BeFood[] {
    const now = Date.now();
    const rows = this.db
      .prepare('SELECT * FROM be_food WHERE eaten_at IS NULL OR eaten_at > ?')
      .all(now - 400) as {
      id: string;
      x: number;
      y: number;
      born_at: number;
      eater_id: string | null;
      eaten_at: number | null;
      sprite_hash: string | null;
    }[];
    const size = SPRITE_SIZE.thuc_an;
    return rows.map((row) => ({
      id: row.id,
      x: row.x,
      y: row.y,
      bornAt: row.born_at,
      eatenAt: row.eaten_at,
      eaterId: row.eater_id,
      sprite: row.sprite_hash
        ? {
            hash: row.sprite_hash,
            url: `/be/g/${row.sprite_hash}.png`,
            w: size.w,
            h: size.h,
            atlas: null,
            ax: 0,
            ay: 0,
          }
        : null,
    }));
  }
}
