import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadDotEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

loadDotEnv();

export const APP_ROOT = root;

export const config = {
  port: Number(process.env.HNG_PORT || 8443),
  dbPath: resolve(root, process.env.HNG_DB || './data/hng.db'),
  tlsCert: resolve(root, process.env.HNG_TLS_CERT || './data/dev-cert.pem'),
  tlsKey: resolve(root, process.env.HNG_TLS_KEY || './data/dev-key.pem'),
  tlsPfx: process.env.HNG_TLS_PFX ? resolve(root, process.env.HNG_TLS_PFX) : '',
  tlsPfxPass: process.env.HNG_TLS_PFX_PASS || '',
  origin: process.env.HNG_ORIGIN || 'https://localhost:8443',
  aiProvider: process.env.HNG_AI_PROVIDER || 'claude',
  aiKey: process.env.HNG_AI_KEY || '',
  aiModel: process.env.HNG_AI_MODEL || 'claude-sonnet-4-20250514',
  devHttp: process.env.HNG_DEV_HTTP === '1',
  backupDir: resolve(root, process.env.HNG_BACKUP_DIR || './data/backup'),
  sessionDays: 30,
  spinDurationMs: 4300,
};
