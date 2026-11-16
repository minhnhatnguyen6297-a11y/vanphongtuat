import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { readPngInfo } from '../shared/be-png.ts';
import { SPRITE_H, SPRITE_W, MAX_SPRITE_BYTES } from '../shared/be.ts';

const HASH64 = /^[a-f0-9]{64}$/;

export function contentHash(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function spriteFileFor(dir: string, hash: string): string | null {
  if (!HASH64.test(hash)) return null;
  const root = resolve(dir);
  const file = join(root, `${hash}.png`);
  if (!file.startsWith(root + sep)) return null;
  return file;
}

export function acceptSprite(buf: Buffer): { ok: true; hash: string } | { ok: false; error: string } {
  if (buf.length < 32 || buf.length > MAX_SPRITE_BYTES) return { ok: false, error: 'size' };
  const info = readPngInfo(buf);
  if (!info) return { ok: false, error: 'png' };
  if (info.w !== SPRITE_W || info.h !== SPRITE_H) return { ok: false, error: 'dim' };
  if (info.bit !== 8 || (info.color !== 6 && info.color !== 2)) return { ok: false, error: 'mode' };
  return { ok: true, hash: contentHash(buf) };
}

export function saveSprite(dir: string, buf: Buffer): { ok: true; hash: string } | { ok: false; error: string } {
  const accepted = acceptSprite(buf);
  if (!accepted.ok) return accepted;
  const file = spriteFileFor(dir, accepted.hash);
  if (!file) return { ok: false, error: 'path' };
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, buf);
  return { ok: true, hash: accepted.hash };
}

export function spriteReady(dir: string, hash: string): boolean {
  const file = spriteFileFor(dir, hash);
  return !!file && existsSync(file);
}

export function readSprite(dir: string, hash: string): Buffer | null {
  const file = spriteFileFor(dir, hash);
  if (!file || !existsSync(file)) return null;
  return readFileSync(file);
}
