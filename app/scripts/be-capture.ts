/**
 * Ảnh cho chủ xem + đo hiệu năng giả lập máy Pentium.
 * Không in PIN. Chạy: npx tsx scripts/be-capture.ts
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import WebSocket from 'ws';
import { encodePng } from '../src/shared/be-png.ts';
import { SPRITE_H, SPRITE_W, templateFishBasic } from '../src/shared/be.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..');
const shotDir = join(repo, 'docs/spec/anh');
const artifactDir = '/opt/cursor/artifacts';
mkdirSync(shotDir, { recursive: true });
mkdirSync(artifactDir, { recursive: true });

const port = 8458;
const origin = `http://127.0.0.1:${port}`;
const pin = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');

const dbFile = join(root, 'data/be-capture.db');
for (const suffix of ['', '-wal', '-shm']) {
  try {
    rmSync(dbFile + suffix);
  } catch {
    /* chưa có */
  }
}

process.env.HNG_E2E = '1';
process.env.HNG_SEED_PIN = pin;
process.env.HNG_DEV_HTTP = '1';
process.env.HNG_PORT = String(port);
process.env.HNG_DB = dbFile;
process.env.HNG_ORIGIN = origin;
process.env.HNG_BE_IDLE_VISIBLE_MS = '180000';
process.env.HNG_BE_IDLE_HIDDEN_MS = '60000';
process.env.HNG_BE_IDLE_WARN_MS = '20000';
process.env.HNG_BE_SWEEP_MS = '1000';
process.env.HNG_BE_SPRITE_DIR = join(root, 'data/be-sprites');

const { startServer } = await import('../src/server/index.ts');
const started = startServer();
await new Promise<void>((resolve) => started.server.once('listening', () => resolve()));

const USERS = ['minh', 'lan', 'tuan', 'huong', 'hoang', 'thao'];

async function login(username: string): Promise<string> {
  const res = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-hng': '1' },
    body: JSON.stringify({ username, pin }),
  });
  if (!res.ok) throw new Error(`login ${username} ${res.status}`);
  const raw = res.headers.get('set-cookie') || '';
  const m = raw.match(/hng_sid=[^;]+/);
  if (!m) throw new Error('cookie');
  return m[0];
}

function fishPng(i: number): Buffer {
  const rgba = Buffer.alloc(SPRITE_W * SPRITE_H * 4);
  const body = [200 + ((i * 37) % 55), 70 + ((i * 29) % 140), 40 + ((i * 53) % 180)];
  const cx = 112;
  const cy = 48;
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const dx = (x - cx) / 52;
      const dy = (y - cy) / 28;
      const inBody = dx * dx + dy * dy <= 1;
      const inTail = x < 58 && Math.abs(y - cy) < 8 + (58 - x) * 0.7;
      if (!inBody && !inTail) continue;
      const o = (y * SPRITE_W + x) * 4;
      const shade = inTail ? 0.75 : 1 - Math.max(0, dy) * 0.25;
      rgba[o] = Math.min(255, body[0] * shade);
      rgba[o + 1] = Math.min(255, body[1] * shade);
      rgba[o + 2] = Math.min(255, body[2] * shade);
      rgba[o + 3] = 255;
      if (inBody && Math.hypot(x - 142, y - 40) < 7) {
        rgba[o] = 255;
        rgba[o + 1] = 255;
        rgba[o + 2] = 255;
      }
      if (inBody && Math.hypot(x - 144, y - 40) < 3) {
        rgba[o] = 20;
        rgba[o + 1] = 20;
        rgba[o + 2] = 20;
      }
    }
  }
  return encodePng(SPRITE_W, SPRITE_H, rgba);
}

async function upload(cookie: string, png: Buffer): Promise<string> {
  const res = await fetch(`${origin}/api/be/sprite`, {
    method: 'POST',
    headers: { origin, 'x-hng': '1', 'content-type': 'image/png', cookie },
    body: new Uint8Array(png),
  });
  if (!res.ok) throw new Error(`sprite ${res.status}`);
  const data = (await res.json()) as { hash: string };
  return data.hash;
}

function wsSend(cookie: string, frames: unknown[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(origin.replace('http', 'ws') + '/ws', { headers: { cookie, origin } });
    const got: unknown[] = [];
    ws.on('open', () => {
      for (const f of frames) ws.send(JSON.stringify(f));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      got.push(msg);
      if (msg.t === 'ack' && String(msg.opId || '').startsWith('fish-')) {
        if (!msg.ok) {
          ws.close();
          reject(new Error(String(msg.error || 'save')));
          return;
        }
        ws.close();
        resolve(got);
      }
    });
    ws.on('error', reject);
  });
}

async function saveFish(cookie: string, i: number, name: string): Promise<void> {
  const hash = await upload(cookie, fishPng(i));
  await wsSend(cookie, [
    { t: 'hello', subs: ['be:room', 'chat:lobby'] },
    { t: 'be.join' },
    {
      t: 'cmd',
      opId: `fish-${i}-${Date.now()}`,
      name: 'be.save',
      args: {
        kind: 'ca',
        name,
        strokes: templateFishBasic(),
        swim: (['active', 'drift', 'cruise', 'bottom'] as const)[i % 4],
        wave: true,
        spriteHash: hash,
        place: true,
        startGrowth: 0.66 + (i % 5) * 0.08,
      },
    },
  ]);
}

async function openChat(page: Page, cookie: string): Promise<void> {
  const sid = cookie.split('=')[1];
  await page.context().addCookies([{ name: 'hng_sid', value: decodeURIComponent(sid), url: origin }]);
  await page.goto(`${origin}/#/chat`);
  await page.locator('[data-be-canvas]').waitFor();
  await page.waitForTimeout(800);
}

async function shoot(page: Page, name: string) {
  const file = join(shotDir, name);
  await page.screenshot({ path: file, fullPage: false });
  writeFileSync(join(artifactDir, name), readFileSync(file));
}

const cookie = await login('minh');
for (let i = 0; i < 10; i++) {
  await saveFish(cookie, i, `Bống ${i + 1}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 980 } });
const page = await context.newPage();
await openChat(page, cookie);
await page.locator('[data-be-fish-count="10"]').waitFor({ timeout: 15000 });
await page.waitForTimeout(600);
await page.evaluate(() => {
  window.__BE_FORCE_TIER = 'cao';
});
await page.waitForTimeout(1200);
await shoot(page, 'be-cao.png');

await page.evaluate(() => {
  window.__BE_FORCE_TIER = 'nhe';
});
await page.waitForTimeout(600);
await shoot(page, 'be-nhe.png');
await page.evaluate(() => {
  window.__BE_FORCE_TIER = 'cao';
});

await page.locator('[data-chat-input]').fill('trưa nay ăn phở nhé');
await page.locator('[data-chat-send]').click();
await page.locator('[data-chat-log]').getByText('trưa nay ăn phở nhé').waitFor();
await shoot(page, 'be-chat.png');

await page.locator('[data-be-add]').click();
await page.locator('[data-kind="ca"]').click();
const pad = page.locator('[data-pad-canvas]');
await pad.waitFor();
const box = await pad.boundingBox();
if (!box) throw new Error('pad');
await page.mouse.move(box.x + 80, box.y + box.height * 0.6);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.72, box.y + 40, { steps: 12 });
await shoot(page, 'be-ve.png');
await page.mouse.up();
await page.locator('[data-pad-next]').click();
await page.locator('[data-pad-next]').click();
await page.locator('[data-pad-next]').click();
await page.getByText('Đã thả').waitFor({ timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(700);
await shoot(page, 'be-tha.png');
await context.close();

const videoDir = join(shotDir, 'video');
mkdirSync(videoDir, { recursive: true });
const videoContext = await browser.newContext({
  viewport: { width: 1600, height: 980 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const videoPage = await videoContext.newPage();
await openChat(videoPage, cookie);
await videoPage.evaluate(() => {
  window.__BE_FORCE_TIER = 'cao';
});
await videoPage.waitForTimeout(5200);
const video = videoPage.video();
await videoContext.close();
const videoPath = video ? await video.path() : '';
if (videoPath) {
  copyFileSync(videoPath, join(shotDir, 'be-boi.webm'));
  copyFileSync(videoPath, join(artifactDir, 'be-boi.webm'));
}

const kickContext = await browser.newContext({ viewport: { width: 1600, height: 980 } });
const kickPage = await kickContext.newPage();
await openChat(kickPage, cookie);
await kickPage.evaluate(() => {
  (window as Window & { __BE_IDLE_VISIBLE_MS?: number; __BE_IDLE_WARN_MS?: number }).__BE_IDLE_VISIBLE_MS = 2500;
  (window as Window & { __BE_IDLE_WARN_MS?: number }).__BE_IDLE_WARN_MS = 800;
});
await kickPage.getByText('Bạn đã rời bể vì vắng lâu').waitFor({ timeout: 15000 });
await shoot(kickPage, 'be-vang.png');
await kickContext.close();

for (let i = 10; i < 36; i++) {
  await saveFish(await login(USERS[i % USERS.length]), i, `Đàn ${i + 1}`);
}

const sockets: WebSocket[] = [];
for (let i = 0; i < 15; i++) {
  const c = await login(USERS[i % USERS.length]);
  const ws = new WebSocket(origin.replace('http', 'ws') + '/ws', { headers: { cookie: c, origin } });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => {
      ws.send(JSON.stringify({ t: 'hello', subs: ['be:room', 'chat:lobby'] }));
      ws.send(JSON.stringify({ t: 'be.join' }));
      resolve();
    });
    ws.once('error', reject);
  });
  sockets.push(ws);
}

const perfBrowser = await chromium.launch({
  headless: true,
  args: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing'],
});
const perfContext = await perfBrowser.newContext({ viewport: { width: 1920, height: 1080 } });
const perf = await perfContext.newPage();
const cdp = await perfContext.newCDPSession(perf);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
const cpuStart = process.cpuUsage();
const tStart = Date.now();
await openChat(perf, cookie);
await perf.waitForFunction(() => Number(document.querySelector('[data-be-root]')?.getAttribute('data-be-fish-count') || '0') >= 30);
await perf.waitForTimeout(1500);
const samples = await perf.evaluate(async () => {
  const out: Array<Record<string, number | string>> = [];
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 500));
    out.push({ ...(window.__BE_STATS__ || {}) });
  }
  const resources = performance.getEntriesByType('resource').map((r) => ({
    name: r.name,
    transfer: (r as PerformanceResourceTiming).transferSize,
    encoded: (r as PerformanceResourceTiming).encodedBodySize,
  }));
  return { out, resources };
});
await perf.reload({ waitUntil: 'load' });
await perf.waitForTimeout(1500);
const warm = await perf.evaluate(() =>
  performance.getEntriesByType('resource').map((r) => ({
    name: r.name,
    transfer: (r as PerformanceResourceTiming).transferSize,
    encoded: (r as PerformanceResourceTiming).encodedBodySize,
  })),
);
const cpu = process.cpuUsage(cpuStart);
const secs = (Date.now() - tStart) / 1000;
const heap = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] as { name: string; value: number }[] }));
const heapBytes = heap.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;

function sumArt(list: { name: string; transfer: number; encoded: number }[], field: 'transfer' | 'encoded') {
  return list.filter((r) => r.name.includes('/art/be/')).reduce((s, r) => s + (r[field] || 0), 0);
}

const fps = samples.out.map((s) => Number(s.fps) || 0).filter((n) => n > 0);
const frame = samples.out.map((s) => Number(s.frameMs) || 0).filter((n) => n > 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const report = {
  method:
    'Giả lập, không phải máy Pentium thật. Chrome headless, cửa sổ 1920×1080, --disable-gpu và --disable-accelerated-2d-canvas, CDP Emulation.setCPUThrottlingRate = 6. 36 cá, 15 socket đang giữ phòng. CPU/RAM là tiến trình Node trên máy ảo, không phải MAY3.',
  fish: 36,
  clients: 15,
  throttle: 6,
  fpsAvg: Math.round(avg(fps) * 10) / 10,
  fpsMin: fps.length ? Math.round(Math.min(...fps) * 10) / 10 : 0,
  frameMsAvg: Math.round(avg(frame) * 10) / 10,
  frameMsMax: frame.length ? Math.round(Math.max(...frame) * 10) / 10 : 0,
  tier: String(samples.out.at(-1)?.tier || ''),
  fishOnScreen: Number(samples.out.at(-1)?.fish || 0),
  draws: Number(samples.out.at(-1)?.draws || 0),
  canvas: `${samples.out.at(-1)?.w || 0}×${samples.out.at(-1)?.h || 0}`,
  jsHeapBytes: heapBytes || Number(samples.out.at(-1)?.heap || 0),
  downloadColdArtBytes: sumArt(samples.resources, 'transfer') || sumArt(samples.resources, 'encoded'),
  downloadWarmArtBytes: sumArt(warm, 'transfer'),
  downloadWarmEncodedBytes: sumArt(warm, 'encoded'),
  serverCpuPercentOneCore: Math.round(((cpu.user + cpu.system) / 1000 / secs) * 10) / 10,
  serverRssBytes: process.memoryUsage().rss,
  sampleSeconds: Math.round(secs * 10) / 10,
};

writeFileSync(join(repo, 'docs/spec/drawquarium-perf.json'), JSON.stringify(report, null, 2));
writeFileSync(join(artifactDir, 'drawquarium-perf.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

for (const ws of sockets) ws.close();
await perfBrowser.close();
await browser.close();
started.server.close();
process.exit(0);
