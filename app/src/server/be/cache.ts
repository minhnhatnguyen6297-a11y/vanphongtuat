import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rasterStrokes } from '../../shared/be/raster.ts';
import { SCENE_V, SPRITE_SIZE, type DrawingKind, type Stroke } from '../../shared/be/types.ts';
import { encodePng } from './png.ts';
import { paintScene, SCENE_NAMES } from './scene.ts';

export function sha20(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 20);
}

export function shaBuf(buf: Buffer | Uint8Array): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  return createHash('sha256').update(b).digest('hex').slice(0, 20);
}

export type Frame = { atlas: number; x: number; y: number; w: number; h: number };

export type PackResult = {
  key: string;
  atlases: { hash: string; w: number; h: number }[];
  frames: Record<string, Frame>;
};

export type SceneInfo = {
  hash: string;
  w: number;
  h: number;
  frames?: number;
  fw?: number;
  fh?: number;
};

const MAX = 1024;
const PAD = 2;

/** Ảnh nướng theo hash. Lần sau chỉ đọc đĩa, không vẽ lại nét. */
export class BakeCache {
  rasterCount = 0;
  hitCount = 0;
  atlasEncodes = 0;
  private memPng = new Map<string, Buffer>();
  private sceneMemo: Record<string, SceneInfo> | null = null;

  constructor(readonly dir: string) {
    mkdirSync(join(dir, 'png'), { recursive: true });
    mkdirSync(join(dir, 'raw'), { recursive: true });
    mkdirSync(join(dir, 'pack'), { recursive: true });
    mkdirSync(join(dir, 'scene'), { recursive: true });
  }

  ensureSprite(hash: string, kind: DrawingKind, strokes: Stroke[]): { w: number; h: number } {
    const size = this.readSize(hash);
    if (size) {
      this.hitCount++;
      return size;
    }
    this.rasterCount++;
    const { w, h } = SPRITE_SIZE[kind];
    const rgba = rasterStrokes(strokes, w, h);
    this.store(hash, w, h, rgba, encodePng(w, h, rgba));
    return { w, h };
  }

  pngOf(hash: string): Buffer | null {
    const hit = this.memPng.get(hash);
    if (hit) return hit;
    const path = join(this.dir, 'png', `${hash}.png`);
    if (!existsSync(path)) return null;
    const buf = readFileSync(path);
    this.memPng.set(hash, buf);
    return buf;
  }

  pack(items: { id: string; hash: string }[]): PackResult {
    const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
    const key = sha20(`pack|${SCENE_V}|` + sorted.map((i) => `${i.id}:${i.hash}`).join('|'));
    const metaPath = join(this.dir, 'pack', `${key}.json`);
    if (existsSync(metaPath)) {
      const saved = JSON.parse(readFileSync(metaPath, 'utf8')) as PackResult;
      if (saved.atlases.every((a) => this.pngOf(a.hash))) return saved;
    }

    const loaded: { id: string; hash: string; w: number; h: number; rgba: Uint8Array }[] = [];
    for (const item of sorted) {
      const raw = this.readRaw(item.hash);
      if (!raw) continue;
      loaded.push({ id: item.id, hash: item.hash, w: raw.w, h: raw.h, rgba: raw.rgba });
    }
    loaded.sort((a, b) => b.h - a.h || a.id.localeCompare(b.id));
    if (!loaded.length) {
      const empty: PackResult = { key, atlases: [], frames: {} };
      writeFileSync(metaPath, JSON.stringify(empty));
      return empty;
    }

    const atlases: { w: number; h: number; rgba: Uint8Array; placed: { id: string; x: number; y: number; w: number; h: number }[] }[] = [];
    let cur = newAtlas();
    atlases.push(cur);
    let x = PAD;
    let y = PAD;
    let rowH = 0;
    for (const it of loaded) {
      if (x + it.w + PAD > MAX) {
        x = PAD;
        y += rowH + PAD;
        rowH = 0;
      }
      if (y + it.h + PAD > MAX) {
        cur.w = MAX;
        cur.h = Math.max(1, y);
        cur = newAtlas();
        atlases.push(cur);
        x = PAD;
        y = PAD;
        rowH = 0;
      }
      cur.placed.push({ id: it.id, x, y, w: it.w, h: it.h });
      blit(cur.rgba, MAX, x, y, it.rgba, it.w, it.h);
      x += it.w + PAD;
      rowH = Math.max(rowH, it.h);
    }
    cur.h = Math.max(1, y + rowH + PAD);
    cur.w = MAX;

    const frames: Record<string, Frame> = {};
    const outAtlases: { hash: string; w: number; h: number }[] = [];
    atlases.forEach((atlas, index) => {
      const usedH = Math.max(1, atlas.h);
      const slice = atlas.rgba.subarray(0, MAX * usedH * 4);
      const png = encodePng(MAX, usedH, slice);
      const hash = shaBuf(png);
      this.store(hash, MAX, usedH, slice, png);
      outAtlases.push({ hash, w: MAX, h: usedH });
      for (const p of atlas.placed) frames[p.id] = { atlas: index, x: p.x, y: p.y, w: p.w, h: p.h };
    });
    this.atlasEncodes++;
    const result: PackResult = { key, atlases: outAtlases, frames };
    writeFileSync(metaPath, JSON.stringify(result));
    return result;
  }

  scenes(): Record<string, SceneInfo> {
    if (this.sceneMemo) return this.sceneMemo;
    const out: Record<string, SceneInfo> = {};
    for (const name of SCENE_NAMES) {
      const pointer = join(this.dir, 'scene', `${SCENE_V}-${name}.json`);
      if (existsSync(pointer)) {
        const info = JSON.parse(readFileSync(pointer, 'utf8')) as SceneInfo;
        if (this.pngOf(info.hash)) {
          out[name] = info;
          continue;
        }
      }
      const painted = paintScene(name);
      const realHash = shaBuf(Buffer.concat([Buffer.from(painted.rgba), Buffer.from(`|${SCENE_V}|${name}`)]));
      if (!this.pngOf(realHash)) {
        this.store(realHash, painted.w, painted.h, painted.rgba, encodePng(painted.w, painted.h, painted.rgba));
      }
      const info: SceneInfo = {
        hash: realHash,
        w: painted.w,
        h: painted.h,
        ...(painted.frames ? { frames: painted.frames, fw: painted.fw, fh: painted.fh } : {}),
      };
      writeFileSync(pointer, JSON.stringify(info));
      out[name] = info;
    }
    this.sceneMemo = out;
    return out;
  }

  private readSize(hash: string): { w: number; h: number } | null {
    const raw = this.readRaw(hash);
    return raw ? { w: raw.w, h: raw.h } : null;
  }

  private readRaw(hash: string): { w: number; h: number; rgba: Uint8Array } | null {
    const path = join(this.dir, 'raw', `${hash}.raw`);
    if (!existsSync(path)) return null;
    const buf = readFileSync(path);
    if (buf.length < 8) return null;
    const w = buf.readUInt32LE(0);
    const h = buf.readUInt32LE(4);
    if (w < 1 || h < 1 || buf.length < 8 + w * h * 4) return null;
    return { w, h, rgba: new Uint8Array(buf.buffer, buf.byteOffset + 8, w * h * 4) };
  }

  private store(hash: string, w: number, h: number, rgba: Uint8Array, png: Buffer) {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(w, 0);
    header.writeUInt32LE(h, 4);
    writeFileSync(join(this.dir, 'raw', `${hash}.raw`), Buffer.concat([header, Buffer.from(rgba)]));
    writeFileSync(join(this.dir, 'png', `${hash}.png`), png);
    this.memPng.set(hash, png);
  }
}

function newAtlas() {
  return {
    w: MAX,
    h: 0,
    rgba: new Uint8Array(MAX * MAX * 4),
    placed: [] as { id: string; x: number; y: number; w: number; h: number }[],
  };
}

function blit(
  dst: Uint8Array,
  dw: number,
  dx: number,
  dy: number,
  src: Uint8Array,
  sw: number,
  sh: number,
) {
  for (let y = 0; y < sh; y++) {
    const from = y * sw * 4;
    const to = ((dy + y) * dw + dx) * 4;
    dst.set(src.subarray(from, from + sw * 4), to);
  }
}
