import { randomInt, randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { hashPin } from '../src/server/auth.ts';
import { config } from '../src/server/config.ts';
import { closeDb, nowIso, openDb } from '../src/server/db.ts';
import { startServer } from '../src/server/index.ts';

let pin = '';
for (let i = 0; i < 6; i++) pin += String(randomInt(0, 10));
writeFileSync('/tmp/hng-be-e2e-pin', pin, { mode: 0o600 });
const username = process.env.HNG_E2E_USER || 'be-e2e';

for (const suffix of ['', '-wal', '-shm']) rmSync(config.dbPath + suffix, { force: true });

const db = openDb(config.dbPath);
const { hash, salt } = hashPin(pin);
db.prepare(
  `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, tier, disabled, created_at)
   VALUES(?,?,?,?,?,?,?,0,?)`,
).run(randomUUID(), username, 'Bống thử', hash, salt, 0, 'dan_den', nowIso());
closeDb();

startServer();
