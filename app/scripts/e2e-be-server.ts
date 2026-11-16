import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pin = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
const data = join(root, 'data');
mkdirSync(data, { recursive: true });
const db = join(data, 'e2e-be.db');
for (const suffix of ['', '-wal', '-shm']) {
  try {
    rmSync(db + suffix);
  } catch {
    /* chưa có */
  }
}
writeFileSync(join(data, 'e2e-be-pin.txt'), pin, { mode: 0o600 });

process.env.HNG_E2E = '1';
process.env.HNG_SEED_PIN = pin;
process.env.HNG_DEV_HTTP = '1';
process.env.HNG_PORT = process.env.HNG_PORT || '8457';
process.env.HNG_DB = db;
process.env.HNG_ORIGIN = `http://127.0.0.1:${process.env.HNG_PORT}`;
process.env.HNG_BE_IDLE_VISIBLE_MS = '600000';
process.env.HNG_BE_IDLE_HIDDEN_MS = '600000';
process.env.HNG_BE_SWEEP_MS = '5000';

const { startServer } = await import('../src/server/index.ts');
startServer();
