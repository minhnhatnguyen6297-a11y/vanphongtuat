/**
 * Tạo/cập nhật u01..u15 với PIN cố định 100001..100015 cho concurrent live.
 * Usage: node scripts/seed-concurrent.mjs
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID, scryptSync, randomBytes } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = resolve(root, process.env.HNG_DB || './data/hng.db');
const dir = dirname(dbPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const SCRYPT_OPTS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const hasMembers = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='members'`)
  .get();
if (!hasMembers) {
  console.error('DB chưa có bảng members — chạy server/seed trước.');
  process.exit(1);
}

const upsert = db.prepare(
  `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, disabled, created_at)
   VALUES(?,?,?,?,?,?,0,?)
   ON CONFLICT(username) DO UPDATE SET
     pin_hash=excluded.pin_hash,
     pin_salt=excluded.pin_salt,
     display_name=excluded.display_name,
     disabled=0`,
);

const find = db.prepare(`SELECT id FROM members WHERE username = ? COLLATE NOCASE`);

const now = new Date().toISOString();
const pins = [];

const tx = db.transaction(() => {
  for (let i = 1; i <= 15; i++) {
    const username = `u${String(i).padStart(2, '0')}`;
    const pin = String(100000 + i).slice(0, 6);
    const salt = randomBytes(16);
    const hash = scryptSync(pin, salt, KEYLEN, SCRYPT_OPTS);
    const existing = find.get(username);
    const id = existing?.id || randomUUID();
    if (existing) {
      db.prepare(`UPDATE members SET pin_hash=?, pin_salt=?, display_name=?, disabled=0 WHERE id=?`).run(
        hash,
        salt,
        `User ${username}`,
        id,
      );
    } else {
      upsert.run(id, username, `User ${username}`, hash, salt, i === 1 ? 1 : 0, now);
    }
    pins.push({ username, pin, isOperator: i === 1 });
  }
});

tx();
console.log('=== CONCURRENT SEED (u01..u15) ===');
for (const p of pins) {
  console.log(`  ${p.username}  PIN=${p.pin}${p.isOperator ? '  [operator]' : ''}`);
}
console.log('==================================');
db.close();
