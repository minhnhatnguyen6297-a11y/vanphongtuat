import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { APP_ROOT } from './config.ts';
import { defaultMatrixRows } from '../shared/perms-catalog.ts';

export type Db = Database.Database;

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) throw new Error('DB not opened');
  return _db;
}

export function openDb(dbPath: string): Db {
  const dir = dirname(dbPath);
  if (dbPath !== ':memory:' && !existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  ensureMigrationsTable(db);
  runMigrations(db);
  seedRolePermissionsIfEmpty(db);

  _db = db;
  return db;
}

export function openMemoryDb(): Db {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureMigrationsTable(db);
  runMigrations(db);
  seedRolePermissionsIfEmpty(db);
  _db = db;
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function ensureMigrationsTable(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function runMigrations(db: Db) {
  const dir = join(APP_ROOT, 'migrations');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied = new Set(
    db.prepare('SELECT id FROM _migrations').all().map((r) => (r as { id: string }).id),
  );
  const insert = db.prepare('INSERT INTO _migrations(id, applied_at) VALUES(?, ?)');
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insert.run(file, new Date().toISOString());
    })();
  }
}

/** Seed ma trận mặc định một lần (sau migration 002). */
export function seedRolePermissionsIfEmpty(db: Db) {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM role_permissions`).get() as { c: number };
    if (row.c > 0) return;
  } catch {
    return;
  }
  const ins = db.prepare(
    `INSERT INTO role_permissions(tier, perm_key, allowed) VALUES(?,?,?)`,
  );
  db.transaction(() => {
    for (const r of defaultMatrixRows()) {
      ins.run(r.tier, r.permKey, r.allowed);
    }
  })();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
