import { readFileSync, rmSync } from 'node:fs';

export default async function globalTeardown(): Promise<void> {
  try {
    const pid = Number(readFileSync('/tmp/hng-playwright-vuon/pid', 'utf8'));
    if (pid) process.kill(-pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
  rmSync('/tmp/hng-playwright-vuon', { recursive: true, force: true });
}
