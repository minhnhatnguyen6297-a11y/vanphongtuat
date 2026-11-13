import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db.ts';
import { config } from './config.ts';

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Sao lưu nhất quán qua better-sqlite3 backup API; giữ 14 bản gần nhất. */
export async function backupDb(db: Db, backupDir = config.backupDir): Promise<string> {
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const dest = join(backupDir, `hng-${stamp()}.db`);
  await db.backup(dest);
  pruneBackups(backupDir, 14);
  return dest;
}

export function pruneBackups(backupDir: string, keep: number) {
  if (!existsSync(backupDir)) return;
  const files = readdirSync(backupDir)
    .filter((f) => /^hng-\d{8}-\d{4}\.db$/.test(f))
    .map((f) => ({ f, m: statSync(join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  for (const x of files.slice(keep)) {
    unlinkSync(join(backupDir, x.f));
  }
}
