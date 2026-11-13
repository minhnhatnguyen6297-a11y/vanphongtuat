/**
 * Smoke: better-sqlite3 backup -> restore DB trong -> verify.
 * Neu src/server/backup.ts ton tai thi ghi chu; khong import logic server.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs');
const tmpDir = resolve(root, 'data', '_backup-smoke');
const reportPath = resolve(outDir, 'BACKUP-RESTORE-SMOKE.md');
const backupTs = resolve(root, 'src/server/backup.ts');

mkdirSync(tmpDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const srcDb = resolve(tmpDir, 'source.db');
const bakDb = resolve(tmpDir, 'hng-smoke-backup.db');
const restoredDb = resolve(tmpDir, 'restored.db');

let ok = false;
let detail = '';

try {
  for (const f of [srcDb, bakDb, restoredDb]) rmSync(f, { force: true });

  const db = new Database(srcDb);
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE members (id TEXT PRIMARY KEY, username TEXT UNIQUE);
    CREATE TABLE tables (id INTEGER PRIMARY KEY, host_id TEXT);
    INSERT INTO members VALUES ('m1','minh'),('m2','lan');
    INSERT INTO tables VALUES (1,'m1');
  `);
  await db.backup(bakDb);
  db.close();

  const bak = new Database(bakDb, { readonly: true });
  await bak.backup(restoredDb);
  bak.close();

  const check = new Database(restoredDb, { readonly: true });
  const members = check.prepare('SELECT COUNT(*) AS c FROM members').get().c;
  const tables = check.prepare('SELECT COUNT(*) AS c FROM tables').get().c;
  check.close();

  if (members !== 2 || tables !== 1) throw new Error(`counts members=${members} tables=${tables}`);
  ok = true;
  detail = `members=${members}, tables=${tables}, better-sqlite3.backup() OK`;
} catch (e) {
  detail = String(e && e.stack ? e.stack : e);
} finally {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const lines = [
  '# Backup / restore smoke',
  '',
  `- Ngay: ${new Date().toISOString()}`,
  `- backup.ts co san: ${existsSync(backupTs) ? 'CO' : 'CHUA (dung API better-sqlite3 truc tiep)'}`,
  `- Ket qua: **${ok ? 'PASS' : 'FAIL'}**`,
  `- Chi tiet: ${detail}`,
  '',
  'Quy trinh giong docs/VAN-HANH.md §4: backup nhat quan -> copy sang DB dich -> mo lai.',
  '',
];
writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(ok ? 'BACKUP_RESTORE_PASS' : 'BACKUP_RESTORE_FAIL', detail);
process.exit(ok ? 0 : 1);
