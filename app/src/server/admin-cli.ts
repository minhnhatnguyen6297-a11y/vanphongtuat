import { openDb, closeDb, nowIso, newId } from './db.ts';
import { config } from './config.ts';
import { hashPin, randomPin } from './auth.ts';
import { setMemberTier } from './perms.ts';

function usage() {
  console.log(`Usage:
  npm run admin -- add <username> "<Display Name>"
  npm run admin -- reset-pin <username|memberId>
  npm run admin -- disable <username|memberId>
  npm run admin -- enable <username|memberId>
  npm run admin -- set-operator <username|memberId> [true|false]
  npm run admin -- backup
`);
}

function findMember(db: ReturnType<typeof openDb>, key: string) {
  return (
    (db.prepare(`SELECT * FROM members WHERE id = ?`).get(key) as any) ||
    (db
      .prepare(`SELECT * FROM members WHERE username = ? COLLATE NOCASE`)
      .get(key) as any)
  );
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    usage();
    process.exit(1);
  }

  const db = openDb(config.dbPath);

  try {
    if (cmd === 'add') {
      const username = rest[0];
      const displayName = rest.slice(1).join(' ').replace(/^"|"$/g, '');
      if (!username || !displayName) {
        usage();
        process.exit(1);
      }
      if (!/^[a-z0-9_]+$/i.test(username)) {
        console.error('username chỉ gồm chữ số và _');
        process.exit(1);
      }
      const exists = findMember(db, username);
      if (exists) {
        console.error('username đã tồn tại');
        process.exit(1);
      }
      const pin = randomPin();
      const { hash, salt } = hashPin(pin);
      const id = newId();
      db.prepare(
        `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, tier, disabled, created_at)
         VALUES(?,?,?,?,?,0,'dan_den',0,?)`,
      ).run(id, username.toLowerCase(), displayName, hash, salt, nowIso());
      console.log(`Created ${username} (${displayName}) id=${id} tier=dan_den`);
      console.log(`PIN (one-time): ${pin}`);
      return;
    }

    if (cmd === 'reset-pin') {
      const key = rest[0];
      const m = findMember(db, key);
      if (!m) {
        console.error('not found');
        process.exit(1);
      }
      const pin = randomPin();
      const { hash, salt } = hashPin(pin);
      db.prepare(`UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ?`).run(hash, salt, m.id);
      console.log(`Reset PIN for ${m.username}: ${pin}`);
      return;
    }

    if (cmd === 'disable' || cmd === 'enable') {
      const key = rest[0];
      const m = findMember(db, key);
      if (!m) {
        console.error('not found');
        process.exit(1);
      }
      const disabled = cmd === 'disable' ? 1 : 0;
      db.prepare(`UPDATE members SET disabled = ? WHERE id = ?`).run(disabled, m.id);
      if (disabled) db.prepare(`UPDATE auth_sessions SET revoked = 1 WHERE member_id = ?`).run(m.id);
      console.log(`${m.username} disabled=${!!disabled}`);
      return;
    }

    if (cmd === 'set-operator') {
      const key = rest[0];
      const flag = (rest[1] ?? 'true').toLowerCase() !== 'false';
      const m = findMember(db, key);
      if (!m) {
        console.error('not found');
        process.exit(1);
      }
      try {
        setMemberTier(db, null, m.id, flag ? 'chu_xi' : 'dan_den');
      } catch (e: any) {
        console.error(e?.code || e?.message || e);
        process.exit(1);
      }
      console.log(`${m.username} is_operator=${flag} tier=${flag ? 'chu_xi' : 'dan_den'}`);
      return;
    }

    if (cmd === 'backup') {
      const { backupDb } = await import('./backup.ts');
      const path = await backupDb(db);
      console.log(`Backup → ${path}`);
      return;
    }

    usage();
    process.exit(1);
  } finally {
    closeDb();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
