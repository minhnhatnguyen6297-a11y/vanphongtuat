#!/usr/bin/env node
/**
 * Drive đăng nhập the way a user does.
 * Usage: node .cursor/skills/verify-vanphongtuat/scripts/drive-login.mjs
 * Reads /tmp/vanphongtuat-verify-run/pins.json written by launch.sh.
 * Writes proof under /tmp/vanphongtuat-verify-evidence/dang-nhap/.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appPkg = join(dirname(fileURLToPath(import.meta.url)), '../../../../app/package.json');
const require = createRequire(appPkg);
const { chromium } = require('playwright');
const Database = require('better-sqlite3');

const state = JSON.parse(readFileSync('/tmp/vanphongtuat-verify-run/pins.json', 'utf8'));
const outDir = '/tmp/vanphongtuat-verify-evidence/dang-nhap';
mkdirSync(outDir, { recursive: true });

const beforeSql = new Database(state.db, { readonly: true });
const sessionsBefore = beforeSql.prepare('select count(*) as c from auth_sessions').get().c;
beforeSql.close();

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const origin = state.origin;
const wsFrames = [];
page.on('websocket', (ws) => {
  ws.on('framereceived', (f) => wsFrames.push(String(f.payload).slice(0, 180)));
});

await page.goto(`${origin}/#/home`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'ĐĂNG NHẬP' }).waitFor();
await page.screenshot({ path: join(outDir, '01-login.png') });

await page.getByRole('button', { name: 'Minh (Bạn)' }).click();
await page.locator('#login-pin').fill(state.pins.minh);
await page.getByRole('button', { name: 'VÀO SẢNH' }).click();
await page.getByRole('link', { name: 'Văn phòng Tuất, Hôm nay ăn gì?' }).waitFor();
await page.getByText('CHÀO MINH!').waitFor();
await page.screenshot({ path: join(outDir, '02-sanh.png') });

const me = await page.evaluate(async () => {
  const r = await fetch('/api/me');
  return { status: r.status, body: await r.json() };
});
if (me.status !== 200 || me.body.member.displayName !== 'Minh (Bạn)') {
  throw new Error(`Sau đăng nhập /api/me không phải Minh: ${JSON.stringify(me)}`);
}

const sql = new Database(state.db, { readonly: true });
const sessions = sql.prepare('select count(*) as c from auth_sessions').get().c;
sql.close();
if (sessions <= sessionsBefore) {
  throw new Error(`Click VÀO SẢNH không thêm auth_sessions (${sessionsBefore} -> ${sessions})`);
}

writeFileSync(
  join(outDir, 'result.json'),
  JSON.stringify(
    {
      feature: 'dang-nhap',
      origin,
      greeting: 'CHÀO MINH!',
      me: me.body.member.displayName,
      sessions,
      wsFrames: wsFrames.length,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(`DRIVE OK  evidence=${outDir}  sessions=${sessions}  wsFrames=${wsFrames.length}`);
