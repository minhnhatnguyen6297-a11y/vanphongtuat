/**
 * Đo bể trên Chrome tắt GPU + CPU throttle, rồi chụp các màn.
 * Không in PIN.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { hashPin, createSession } from '../src/server/auth.ts';
import { APP_ROOT } from '../src/server/config.ts';
import { closeDb, nowIso, openDb } from '../src/server/db.ts';
import { BeRuntime } from '../src/server/be/runtime.ts';
import { CmdError } from '../src/server/errors.ts';
import { demoCreature, demoPlant } from '../src/shared/be/samples.ts';
import { validateStrokes } from '../src/shared/be/strokes.ts';
import type { AuthMember } from '../src/server/perms.ts';

const PORT = 8461;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DB = '/tmp/hng-be-perf.db';
const ART = '/opt/cursor/artifacts';
const CACHE = join(APP_ROOT, 'data', 'be-cache');

type Member = { member: AuthMember; id: string };

function clkTck(): number {
  try {
    return Number(readFileSync('/proc/self/stat', 'utf8').split(' ')[0]) && 100;
  } catch {
    return 100;
  }
}

function procCpu(pid: number): { ticks: number; wall: number } {
  const raw = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const rest = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
  const utime = Number(rest[11]);
  const stime = Number(rest[12]);
  return { ticks: utime + stime, wall: Date.now() };
}

async function saveRetry(be: BeRuntime, member: AuthMember, args: Record<string, unknown>) {
  for (;;) {
    try {
      return be.saveDrawing(member, args);
    } catch (err) {
      if (err instanceof CmdError && err.code === 'be_rate') {
        await new Promise((r) => setTimeout(r, 280));
        continue;
      }
      throw err;
    }
  }
}

async function prepareAsync(): Promise<{ session: string; bake: Record<string, number> }> {
  rmSync(DB, { force: true });
  rmSync(DB + '-wal', { force: true });
  rmSync(DB + '-shm', { force: true });
  rmSync(CACHE, { recursive: true, force: true });
  const db = openDb(DB);
  const people = [
    ['minh', 'Minh', 'chu_xi', 1],
    ['lan', 'Lan', 'dan_den', 0],
    ['tuan', 'Tuấn', 'dan_den', 0],
    ['huong', 'Hương', 'dan_den', 0],
  ] as const;
  const members: Member[] = [];
  for (const [username, displayName, tier, op] of people) {
    const secret = String(100000 + Math.floor(Math.random() * 900000));
    const { hash, salt } = hashPin(secret);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, tier, disabled, created_at)
       VALUES(?,?,?,?,?,?,?,0,?)`,
    ).run(id, username, displayName, hash, salt, op, tier, nowIso());
    members.push({
      id,
      member: {
        id,
        username,
        displayName,
        isOperator: op === 1,
        tier,
        avatarId: null,
        disabled: false,
      },
    });
  }
  const now = nowIso();
  db.prepare(
    `INSERT INTO chat_messages(id, scope, member_id, body, created_at) VALUES(?,?,?,?,?)`,
  ).run(randomUUID(), 'lobby', members[0].id, 'trưa ăn gì?', now);
  db.prepare(
    `INSERT INTO chat_messages(id, scope, member_id, body, created_at) VALUES(?,?,?,?,?)`,
  ).run(randomUUID(), 'lobby', members[1].id, 'phở nhé', now);

  const be = new BeRuntime(db, { cacheDir: CACHE });
  const cpu0 = process.cpuUsage();
  const t0 = Date.now();
  for (let i = 0; i < 36; i++) {
    const who = members[i % members.length];
    const demo = demoCreature(i);
    const checked = validateStrokes(demo.strokes);
    if (!checked.ok) throw new Error('nét mẫu không hợp lệ');
    const saved = await saveRetry(be, who.member, {
      kind: demo.kind,
      name: demo.name,
      strokes: demo.strokes,
      swim: demo.swim,
      wave: demo.wave,
    });
    be.release(who.member, { id: (saved.result as { id: string }).id });
  }
  for (let i = 0; i < 4; i++) {
    const who = members[i % members.length];
    const demo = demoPlant(i);
    const saved = await saveRetry(be, who.member, {
      kind: demo.kind,
      name: demo.name,
      strokes: demo.strokes,
      swim: 'thuong',
      wave: false,
    });
    be.release(who.member, { id: (saved.result as { id: string }).id });
  }
  be.rebuildAtlasSync();
  be.publicState(members[0].member);
  const cpu1 = process.cpuUsage(cpu0);
  const bake = {
    wallMs: Date.now() - t0,
    cpuMs: Math.round((cpu1.user + cpu1.system) / 1000),
    raster: be.cache.rasterCount,
    hits: be.cache.hitCount,
    atlas: be.cache.atlasEncodes,
  };
  const session = createSession(db, members[0].id);
  be.stop();
  closeDb();
  return { session, bake };
}

function startChild(extra: Record<string, string>): ChildProcess {
  return spawn('npx', ['tsx', 'src/server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HNG_DEV_HTTP: '1',
      HNG_PORT: String(PORT),
      HNG_ORIGIN: ORIGIN,
      HNG_DB: DB,
      HNG_BE_PERF: '1',
      HNG_BE_IDLE_VISIBLE_MS: '900000',
      HNG_BE_IDLE_HIDDEN_MS: '300000',
      HNG_BE_IDLE_WARN_MS: '60000',
      ...extra,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitUp(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  let log = '';
  child.stdout?.on('data', (b) => {
    log += String(b);
  });
  child.stderr?.on('data', (b) => {
    log += String(b);
  });
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error('server thoát sớm');
    try {
      const res = await fetch(ORIGIN + '/');
      if (res.ok) return;
    } catch {
      /* chưa nghe */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server không lên');
}

function kill(child: ChildProcess) {
  child.kill('SIGTERM');
}

async function resources(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes('/be/'))
      .map((r) => {
        const res = r as PerformanceResourceTiming;
        return {
          name: res.name.split('/').slice(-2).join('/'),
          transfer: res.transferSize,
          encoded: res.encodedBodySize,
        };
      }),
  );
}

async function main() {
  mkdirSync(ART, { recursive: true });
  mkdirSync('/tmp/be-video', { recursive: true });
  console.log('bake…');
  const { session, bake } = await prepareAsync();
  console.log('bake', bake);

  const child = startChild({});
  await waitUp(child);
  const browser: Browser = await chromium.launch({
    args: [
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu-compositing',
      '--enable-precise-memory-info',
    ],
  });

  const perfCtx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await perfCtx.addCookies([
    { name: 'hng_sid', value: session, url: ORIGIN, httpOnly: true, sameSite: 'Strict' },
  ]);
  const perfPage = await perfCtx.newPage();
  const cdp = await perfCtx.newCDPSession(perfPage);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await perfPage.goto(`${ORIGIN}/?bePerf=1#/chat`);
  await perfPage.waitForFunction(() => (window as unknown as { __BE__?: { ready?: boolean; fish?: number } }).__BE__?.ready && ((window as unknown as { __BE__?: { fish?: number } }).__BE__?.fish ?? 0) >= 30, null, { timeout: 20_000 });
  const cold = await resources(perfPage);
  const cpuA = procCpu(child.pid!);
  await perfPage.waitForTimeout(8000);
  const cpuB = procCpu(child.pid!);
  const stats = await perfPage.evaluate(() => (window as unknown as { __BE__?: unknown }).__BE__);
  const metrics = await cdp.send('Performance.getMetrics');
  const heap = (metrics.metrics as { name: string; value: number }[]).find((m) => m.name === 'JSHeapUsedSize');
  await perfPage.reload();
  await perfPage.waitForFunction(() => (window as unknown as { __BE__?: { ready?: boolean } }).__BE__?.ready, null, { timeout: 20_000 });
  const warm = await resources(perfPage);
  await perfCtx.close();

  const swim = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: { dir: '/tmp/be-video', size: { width: 1366, height: 768 } },
  });
  await swim.addCookies([
    { name: 'hng_sid', value: session, url: ORIGIN, httpOnly: true, sameSite: 'Strict' },
  ]);
  const swimPage = await swim.newPage();
  await swimPage.goto(`${ORIGIN}/#/chat`);
  await swimPage.waitForFunction(() => (window as unknown as { __BE__?: { fish?: number; ready?: boolean } }).__BE__?.ready && ((window as unknown as { __BE__?: { fish?: number } }).__BE__?.fish ?? 0) >= 30, null, { timeout: 20_000 });
  await swimPage.locator('[data-be-quality]').selectOption('cao');
  await swimPage.waitForTimeout(5000);
  const video = swimPage.video();
  await swim.close();
  if (video) writeFileSync(join(ART, 'be-tank-swimming.webm'), readFileSync(await video.path()));

  const shot = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await shot.addCookies([
    { name: 'hng_sid', value: session, url: ORIGIN, httpOnly: true, sameSite: 'Strict' },
  ]);
  const page = await shot.newPage();
  await page.goto(`${ORIGIN}/#/chat`);
  await page.waitForFunction(() => (window as unknown as { __BE__?: { fish?: number; ready?: boolean } }).__BE__?.ready && ((window as unknown as { __BE__?: { fish?: number } }).__BE__?.fish ?? 0) >= 30, null, { timeout: 20_000 });
  await page.locator('[data-be-quality]').selectOption('cao');
  await page.waitForTimeout(800);
  await page.locator('[data-be-canvas]').screenshot({ path: join(ART, 'be-tank-cao.png') });
  await page.screenshot({ path: join(ART, 'be-chat-beside-tank.png') });
  await page.locator('[data-be-quality]').selectOption('nhe');
  await page.waitForTimeout(500);
  await page.locator('[data-be-canvas]').screenshot({ path: join(ART, 'be-tank-nhe.png') });

  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByRole('button', { name: 'Cá', exact: true }).click();
  const pad = page.locator('[data-be-pad]');
  await pad.waitFor({ state: 'visible' });
  const box = await pad.boundingBox();
  if (!box) throw new Error('không có giấy vẽ');
  await page.mouse.move(box.x + 36, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.42, { steps: 10 });
  await page.screenshot({ path: join(ART, 'be-pad-drawing.png') });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('button', { name: 'Thả vào bể' }).click();
  await page.locator('[data-be-padwrap]').waitFor({ state: 'hidden' });
  const list = page.locator('[data-be-fishlist]');
  if (await list.isVisible()) await page.locator('[data-be-list]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(ART, 'be-fish-released.png') });
  await shot.close();
  await browser.close();
  kill(child);
  await new Promise<void>((resolve) => {
    if (child.exitCode != null) resolve();
    else child.once('exit', () => resolve());
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3000);
  });

  const kick = startChild({
    HNG_PORT: '8462',
    HNG_ORIGIN: 'http://127.0.0.1:8462',
    HNG_BE_IDLE_VISIBLE_MS: '2500',
    HNG_BE_IDLE_WARN_MS: '700',
    HNG_BE_IDLE_HIDDEN_MS: '1500',
  });
  const kickOrigin = 'http://127.0.0.1:8462';
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(kickOrigin + '/')).ok) break;
    } catch {
      /* chờ */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const b2 = await chromium.launch({ args: ['--disable-gpu'] });
  const c2 = await b2.newContext({ viewport: { width: 1366, height: 768 } });
  await c2.addCookies([
    { name: 'hng_sid', value: session, url: kickOrigin, httpOnly: true, sameSite: 'Strict' },
  ]);
  const p2 = await c2.newPage();
  await p2.goto(`${kickOrigin}/#/chat`);
  await p2.locator('[data-be-kick]').waitFor({ timeout: 15_000 });
  await p2.screenshot({ path: join(ART, 'be-idle-kick.png') });
  await b2.close();
  kill(kick);

  const hz = clkTck();
  const cpuPct = ((cpuB.ticks - cpuA.ticks) / hz / ((cpuB.wall - cpuA.wall) / 1000)) * 100;
  const sum = (rows: { transfer: number; encoded: number }[], key: 'transfer' | 'encoded') =>
    rows.reduce((n, r) => n + r[key], 0);
  const report = {
    throttle: 'Emulation.setCPUThrottlingRate 6',
    chromeArgs: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing'],
    fish: 36,
    plants: 4,
    users: 4,
    bake,
    watchMs: cpuB.wall - cpuA.wall,
    serverCpuPercentOneCore: Math.round(cpuPct * 10) / 10,
    stats,
    heapBytes: heap?.value ?? null,
    cold: { files: cold.length, transfer: sum(cold, 'transfer'), encoded: sum(cold, 'encoded') },
    warm: { files: warm.length, transfer: sum(warm, 'transfer'), encoded: sum(warm, 'encoded') },
  };
  writeFileSync(join(ART, 'be-perf.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
