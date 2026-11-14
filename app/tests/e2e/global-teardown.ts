import { readFileSync, rmSync, existsSync } from 'node:fs';

export default async function globalTeardown(): Promise<void> {
  const pidFile = '/tmp/hng-playwright-e2e/pid';
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, 'utf8'));
    if (pid) {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        try { process.kill(pid, 'SIGTERM'); } catch { /* already stopped */ }
      }
    }
  }
  rmSync('/tmp/hng-playwright-e2e', { recursive: true, force: true });
}
