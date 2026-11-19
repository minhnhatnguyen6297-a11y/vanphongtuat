import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const dir = '/tmp/hng-playwright-e2e';

export default async function globalSetup(): Promise<void> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(`${dir}/backup`, { recursive: true });
  const port = 8490;
  const origin = `http://127.0.0.1:${port}`;
  const logPath = `${dir}/server.log`;
  const logFd = openSync(logPath, 'w');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: new URL('../../', import.meta.url).pathname,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      HNG_DEV_HTTP: '1',
      HNG_PORT: String(port),
      HNG_ORIGIN: origin,
      HNG_DB: `${dir}/hng.db`,
      HNG_BACKUP_DIR: `${dir}/backup`,
    },
  });
  writeFileSync(`${dir}/pid`, String(child.pid));
  for (let i = 0; i < 50; i++) {
    const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    if (/PIN=\d{6}/.test(log)) {
      try {
        const roster = await fetch(`${origin}/api/roster`).then((r) => r.json());
        if (Array.isArray(roster) && roster.some((m: { username: string }) => m.username === 'minh')) {
          const pins: Record<string, string> = {};
          for (const m of log.matchAll(/^\s+(\w+)\s+.+?PIN=(\d{6})/gm)) pins[m[1]] = m[2];
          writeFileSync(`${dir}/pins.json`, JSON.stringify({ origin, pins, db: `${dir}/hng.db` }));
          return;
        }
      } catch {
        /* server still booting */
      }
    }
    await delay(200);
  }
  throw new Error(`e2e server không sẵn sàng. Xem ${logPath}`);
}
