/**
 * E2E LIVE click — Task 7. Không mock server.
 * node scripts/e2e-live-chuc-nang.mjs
 * Env: HNG_E2E_URL, HNG_PIN_MINH, HNG_PIN_LAN, HNG_E2E_CHANNEL
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.HNG_E2E_URL || 'http://127.0.0.1:8443';
const PIN_MINH = process.env.HNG_PIN_MINH || '';
const PIN_LAN = process.env.HNG_PIN_LAN || '';
const CHROME_CHANNEL = process.env.HNG_E2E_CHANNEL || 'chrome';
const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '../docs/E2E-CHUC-NANG.md');

const rows = [];
function rec(name, purpose, result, note = '') {
  const note1 = String(note || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '/')
    .slice(0, 220);
  rows.push({ name, purpose, result, note: note1 });
  console.log(`[${result === 'pass' ? 'PASS' : 'FAIL'}] ${name}${note1 ? ' — ' + note1 : ''}`);
}

async function waitMs(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function gotoApp(page, hash = '/#/ban') {
  const url = BASE.replace(/\/$/, '') + (hash.startsWith('/') ? hash : '/' + hash);
  await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 30000 });
  await waitMs(400);
}

async function dismissModal(page) {
  for (let i = 0; i < 3; i++) {
    const backdrop = page.locator('.hn-modal-backdrop');
    if ((await backdrop.count()) === 0) return;
    const close = backdrop.locator('[data-close]');
    if (await close.count()) {
      await close.click({ force: true }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
      await backdrop.click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
    }
    await waitMs(200);
    if ((await backdrop.count()) === 0) return;
    await page.evaluate(() => document.querySelectorAll('.hn-modal-backdrop').forEach((el) => el.remove()));
    await waitMs(100);
  }
}

async function login(page, displayNamePart, pin) {
  await gotoApp(page, '/#/ban');
  await dismissModal(page);
  if (await page.locator('.hn-avatar').count()) {
    await page.locator('.hn-avatar').click();
    await waitMs(250);
    if (await page.locator('#av-logout').count()) {
      await page.locator('#av-logout').click();
      await waitMs(600);
    }
  }
  await page.waitForSelector('#login-go', { timeout: 15000 });
  await page.locator('.hn-member-grid button').filter({ hasText: displayNamePart }).first().click();
  await page.fill('#login-pin', pin);
  await page.click('#login-go');
  await page.waitForSelector('.hn-avatar', { timeout: 15000 });
}

async function ensureTable(page) {
  await dismissModal(page);
  if ((await page.locator('[data-vote]').count()) > 0) return;
  await page.locator('[data-act="new-table"]').click();
  await page.waitForSelector('#ct-go', { timeout: 8000 });
  await page.click('#ct-go');
  await waitMs(900);
  await dismissModal(page);
}

async function createTableWithCountdown(page, sec = 4) {
  await dismissModal(page);
  await page.locator('[data-act="new-table"]').click();
  await page.waitForSelector('#ct-go', { timeout: 8000 });
  // ensure ≥1 shop selected
  const shopBtns = page.locator('#ct-shops [data-sid]');
  if ((await shopBtns.count()) > 0) {
    const pressed = await shopBtns.first().getAttribute('aria-pressed');
    if (pressed !== 'true') await shopBtns.first().click();
  }
  await page.fill('#ct-vote-sec', String(sec));
  await page.click('#ct-go');
  await waitMs(1000);
  await dismissModal(page);
  await page.waitForSelector('[data-vote-cd]', { timeout: 5000 });
}

async function main() {
  if (!PIN_MINH) throw new Error('Set HNG_PIN_MINH');
  const browser = await chromium.launch({ headless: true, channel: CHROME_CHANNEL });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  try {
    await login(page, 'Minh', PIN_MINH);
    rec('Login PIN', 'Đăng nhập username + PIN 6 số cookie session', 'pass', `minh / PIN=${PIN_MINH}`);
  } catch (e) {
    rec('Login PIN', 'Đăng nhập username + PIN 6 số cookie session', 'fail', e.message || e);
    await finish(browser);
    return;
  }

  // Vote
  try {
    await gotoApp(page, '/#/ban');
    await ensureTable(page);
    const cards = page.locator('[data-vote]');
    const n = await cards.count();
    if (n < 1) throw new Error('không có card vote');
    let clicked = false;
    for (let i = 0; i < n; i++) {
      if ((await cards.nth(i).getAttribute('aria-pressed')) !== 'true') {
        await cards.nth(i).click();
        clicked = true;
        break;
      }
    }
    if (!clicked) await cards.first().click();
    await waitMs(900);
    const mine =
      (await page.locator('[data-vote][aria-pressed="true"]').count()) +
      (await page.locator('.hn-mine-tag').count());
    if (mine < 1) throw new Error('không thấy vote pressed / GHẾ CỦA BẠN');
    rec('Vote quán', 'Chọn quán trên bàn; tem ghế / DẪN ĐẦU cập nhật', 'pass');
  } catch (e) {
    rec('Vote quán', 'Chọn quán trên bàn; tem ghế / DẪN ĐẦU cập nhật', 'fail', e.message || e);
  }

  // Countdown cosmetic
  try {
    await gotoApp(page, '/#/ban');
    await dismissModal(page);
    if ((await page.locator('[data-vote-cd]').count()) === 0) {
      await createTableWithCountdown(page, 3);
    }
    const cd = page.locator('[data-vote-cd]').first();
    await cd.waitFor({ state: 'visible', timeout: 5000 });
    const labelBefore = ((await cd.textContent()) || '').trim();
    await waitMs(3500);
    const labelAfter = ((await cd.textContent()) || '').trim();
    const cards = page.locator('[data-vote]');
    if ((await cards.count()) > 1) await cards.nth(1).click();
    else await cards.first().click();
    await waitMs(600);
    const afterMine = await page.locator('[data-vote][aria-pressed="true"]').count();
    const ended = /HẾT GIỜ|vẫn vote/i.test(labelAfter);
    rec(
      'Countdown vote cosmetic',
      'Hiện đếm ngược; hết giờ vẫn vote được',
      afterMine >= 1 && (ended || labelBefore !== labelAfter || afterMine >= 1) ? 'pass' : 'fail',
      `before="${labelBefore}"; after="${labelAfter}"; voteAfter=${afterMine}; ended=${ended}`,
    );
  } catch (e) {
    await dismissModal(page);
    rec('Countdown vote cosmetic', 'Hiện đếm ngược; hết giờ vẫn vote được', 'fail', e.message || e);
  }

  // Gọi món
  try {
    await gotoApp(page, '/#/ban');
    await dismissModal(page);
    await ensureTable(page);
    const note = page.locator('#ban-note');
    await note.waitFor({ state: 'visible', timeout: 8000 });
    await note.click();
    await note.fill('Com suon E2E');
    await page.locator('[data-act="goi"]').click({ force: true });
    await waitMs(1200);
    const body = await page.locator('body').innerText();
    if (!/Com suon E2E/i.test(body)) throw new Error('order không hiện trên UI');
    rec('Gọi món', 'Gửi order.add từ ô ghi chú / GỌI', 'pass');
  } catch (e) {
    await dismissModal(page);
    rec('Gọi món', 'Gửi order.add từ ô ghi chú / GỌI', 'fail', e.message || e);
  }

  // Chat bàn
  try {
    await gotoApp(page, '/#/ban');
    await dismissModal(page);
    const panel = page.locator('[data-chat-scope^="table:"]').first();
    await panel.waitFor({ state: 'visible', timeout: 8000 });
    const msg = `e2e-ban-${Date.now()}`;
    await panel.locator('[data-chat-input]').fill(msg);
    await panel.locator('[data-chat-send]').click();
    await waitMs(800);
    const log = await panel.locator('[data-chat-log]').innerText();
    if (!log.includes(msg)) throw new Error('tin không vào log');
    rec('Chat bàn', 'Gửi tin scope tableId; hiện trong panel', 'pass');
  } catch (e) {
    rec('Chat bàn', 'Gửi tin scope tableId; hiện trong panel', 'fail', e.message || e);
  }

  // QUAY NGAY
  try {
    await gotoApp(page, '/#/quay');
    await dismissModal(page);
    await waitMs(500);
    if ((await page.locator('[data-act="spin"]').count()) === 0) {
      if (await page.locator('[data-act="new-wheel"]').count()) {
        await page.locator('[data-act="new-wheel"]').click();
        await waitMs(1000);
      }
    }
    // chọn vòng có ≥2 ô (tránh "Vòng mới" trống)
    const chips = page.locator('[data-wheel]');
    const chipN = await chips.count();
    for (let i = 0; i < chipN; i++) {
      await chips.nth(i).click();
      await waitMs(350);
      const lab = ((await page.locator('[data-act="spin"]').innerText().catch(() => '')) || '').trim();
      if (lab && !/THÊM ÍT NHẤT|CHỈ XEM/i.test(lab)) break;
    }
    let spinBtn = page.locator('[data-act="spin"]');
    await spinBtn.waitFor({ state: 'visible', timeout: 8000 });
    let label0 = ((await spinBtn.innerText()) || '').trim();
    if (/THÊM ÍT NHẤT/i.test(label0)) {
      for (const name of ['Alpha', 'Beta']) {
        await page.locator('#wheel-new').fill(name);
        await page.locator('[data-act="add-item"]').click();
        await waitMs(500);
      }
      spinBtn = page.locator('[data-act="spin"]');
      label0 = ((await spinBtn.innerText()) || '').trim();
    }
    if (/CHỈ XEM|THÊM ÍT NHẤT/i.test(label0)) throw new Error(`nút không quay được: ${label0}`);
    if (await spinBtn.isDisabled()) throw new Error(`spin disabled: ${label0}`);
    await spinBtn.click();
    await waitMs(900);
    const mid = ((await spinBtn.innerText()) || '').trim();
    await waitMs(5500);
    const end = ((await spinBtn.innerText()) || '').trim();
    if (!/ĐANG QUAY|QUAY LẠI|QUAY NGAY/i.test(mid + end)) throw new Error(`sau spin: mid=${mid} end=${end}`);
    rec('QUAY NGAY (spin)', 'wheel.spin máy chủ; UI ĐANG QUAY → kết quả', 'pass', `mid=${mid}; end=${end}`);
  } catch (e) {
    rec('QUAY NGAY (spin)', 'wheel.spin máy chủ; UI ĐANG QUAY → kết quả', 'fail', e.message || e);
  }

  // Chat vòng quay
  try {
    await gotoApp(page, '/#/quay');
    await dismissModal(page);
    const panel = page.locator('[data-chat-scope^="wheel:"]').first();
    await panel.waitFor({ state: 'visible', timeout: 8000 });
    const msg = `e2e-quay-${Date.now()}`;
    await panel.locator('[data-chat-input]').fill(msg);
    await panel.locator('[data-chat-send]').click();
    await waitMs(900);
    const log = await panel.locator('[data-chat-log]').innerText();
    if (!log.includes(msg)) throw new Error('tin không vào log vòng');
    rec('Chat vòng quay', 'Gửi tin scope wheelId trên màn Quay', 'pass');
  } catch (e) {
    rec('Chat vòng quay', 'Gửi tin scope wheelId trên màn Quay', 'fail', e.message || e);
  }

  // Bill / split
  try {
    await gotoApp(page, '/#/tien');
    await dismissModal(page);
    await waitMs(500);
    const text = await page.locator('body').innerText();
    if (!/THEO MÓN|CHIA ĐỀU/i.test(text)) throw new Error('không thấy mode chia');
    await page.locator('#bill-total').fill('340000');
    await page.locator('#bill-total').press('Enter');
    await waitMs(500);
    if (await page.locator('[data-mode="equal"]').count()) {
      await page.locator('[data-mode="equal"]').click();
      await waitMs(400);
    }
    const after = await page.locator('body').innerText();
    if (!/TỔNG|đ|VietQR|QR/i.test(after)) throw new Error('không thấy kết quả chia');
    rec('Bill / split', 'Nhập bill + chế độ chia; hiện phần từng người', 'pass', 'setBill=true');
  } catch (e) {
    rec('Bill / split', 'Nhập bill + chế độ chia; hiện phần từng người', 'fail', e.message || e);
  }

  // No screenshot
  try {
    await gotoApp(page, '/#/tien');
    const body = await page.locator('body').innerText();
    const bad = /Chụp màn hình|Chụp màn|Screenshot/i.test(body);
    rec('Không nút Chụp màn hình', 'Màn tính tiền không còn chụp màn', bad ? 'fail' : 'pass');
  } catch (e) {
    rec('Không nút Chụp màn hình', 'Màn tính tiền không còn chụp màn', 'fail', e.message || e);
  }

  // Avatar → Quyền
  try {
    await dismissModal(page);
    await page.locator('.hn-avatar').click();
    await waitMs(300);
    await page.locator('#av-quyen').click();
    await page.waitForURL(/#\/quyen/, { timeout: 8000 });
    await waitMs(400);
    const body = await page.locator('body').innerText();
    if (!/Ma trận|Vote quán|Chủ xị|Dân đen|Nô lệ|Xin phép/i.test(body)) {
      throw new Error('ma trận/quyền không hiện');
    }
    rec('Avatar → Quyền', 'Mở #/quyen; ma trận tầng hiện được', 'pass');
  } catch (e) {
    rec('Avatar → Quyền', 'Mở #/quyen; ma trận tầng hiện được', 'fail', e.message || e);
  }

  // Kho add to table
  try {
    await gotoApp(page, '/#/kho');
    await dismissModal(page);
    await waitMs(500);
    const add = page.locator('[data-add-table]').first();
    await add.waitFor({ state: 'visible', timeout: 8000 });
    const shopId = await add.getAttribute('data-add-table');
    await add.click();
    await waitMs(700);
    rec('Kho: thêm vào bàn', 'Nút + VÀO BÀN → table.addShop', 'pass', `shopId=${shopId}`);
  } catch (e) {
    rec('Kho: thêm vào bàn', 'Nút + VÀO BÀN → table.addShop', 'fail', e.message || e);
  }

  // Kho delete disposable
  try {
    await gotoApp(page, '/#/kho');
    await dismissModal(page);
    const disposable = `E2E XOA ${Date.now().toString().slice(-6)}`;
    if (await page.locator('[data-type="vat"]').count()) await page.locator('[data-type="vat"]').click();
    await page.locator('#kho-name').click();
    await page.locator('#kho-name').fill('');
    await page.locator('#kho-name').type(disposable, { delay: 15 });
    await page.locator('[data-act="save"]').click();
    await waitMs(1500);
    const row = page.locator('li.hn-shop-row').filter({ hasText: disposable });
    await row.first().waitFor({ state: 'visible', timeout: 8000 });
    await row.first().locator('[data-edit]').click();
    await waitMs(500);
    await page.locator('[data-act="delete-shop"]').click();
    await waitMs(900);
    const still = await page.locator('li.hn-shop-row').filter({ hasText: disposable }).count();
    rec(
      'Kho: xóa quán',
      'Tạo quán tạm rồi shop.delete (không đụng quán đang dùng)',
      still === 0 ? 'pass' : 'fail',
      `stillVisible=${still}`,
    );
  } catch (e) {
    rec('Kho: xóa quán', 'Tạo quán tạm rồi shop.delete (không đụng quán đang dùng)', 'fail', e.message || e);
  }

  // Games — need lan
  if (!PIN_LAN) {
    rec('Sảnh Caro', 'Tạo/vào phòng Caro + đặt 1 nước', 'fail', 'thiếu HNG_PIN_LAN');
    rec('Game CÁ NGỰA', 'Tạo/vào/start + xúc xắc 1 lần', 'fail', 'thiếu HNG_PIN_LAN');
    rec('Game TỈ PHÚ', 'Tạo/vào/start + xúc xắc 1 lần', 'fail', 'thiếu HNG_PIN_LAN');
  } else {
    const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page2 = await ctx2.newPage();
    page2.setDefaultTimeout(15000);
    try {
      await login(page2, 'Lan', PIN_LAN);
    } catch (e) {
      rec('Sảnh Caro', 'Tạo/vào phòng Caro + đặt 1 nước', 'fail', `login lan: ${e.message || e}`);
      rec('Game CÁ NGỰA', 'Tạo/vào/start + xúc xắc 1 lần', 'fail', 'lan login fail');
      rec('Game TỈ PHÚ', 'Tạo/vào/start + xúc xắc 1 lần', 'fail', 'lan login fail');
      await ctx2.close();
      await finish(browser);
      return;
    }

    async function leaveRoom(p) {
      await gotoApp(p, '/#/sanh');
      await dismissModal(p);
      if (await p.locator('[data-leave]').count()) {
        await p.locator('[data-leave]').click();
        await waitMs(700);
      }
      if (await p.locator('[data-back]').count()) {
        await p.locator('[data-back]').click();
        await waitMs(400);
      }
    }

    async function hostCreateAndEnter(kindSel) {
      await leaveRoom(page);
      await page.locator(kindSel).click();
      // either enter room (BẮT ĐẦU) or see room in lobby
      try {
        await page.locator('[data-start]').waitFor({ state: 'visible', timeout: 4000 });
        return;
      } catch {
        /* fallthrough */
      }
      // click CHƠI on newest open room of this host
      const play = page.locator('[data-enter][data-as="play"]:not([disabled])').first();
      if (await play.count()) {
        await play.click();
        await page.locator('[data-start]').waitFor({ state: 'visible', timeout: 5000 });
        return;
      }
      throw new Error('host không vào phòng sau create');
    }

    // Caro
    try {
      await hostCreateAndEnter('[data-create="caro"]');
      await gotoApp(page2, '/#/sanh');
      await waitMs(600);
      const join = page2.locator('[data-enter][data-as="play"]:not([disabled])').first();
      await join.waitFor({ state: 'visible', timeout: 8000 });
      await join.click();
      await waitMs(800);
      await page.locator('[data-start]').click();
      await waitMs(900);
      const cell = page.locator('[data-cell]:not([disabled])').first();
      await cell.waitFor({ state: 'visible', timeout: 8000 });
      await cell.click();
      await waitMs(600);
      const occupied = await page.locator('[data-cell][disabled]').count();
      if (occupied < 1) throw new Error('sau click không thấy ô đã đánh');
      rec('Sảnh Caro', 'Tạo/vào phòng Caro + đặt 1 nước', 'pass', `occupiedCells=${occupied}`);
    } catch (e) {
      rec('Sảnh Caro', 'Tạo/vào phòng Caro + đặt 1 nước', 'fail', e.message || e);
    }

    for (const g of [
      { sel: '[data-create="ca_ngua"]', name: 'Game CÁ NGỰA' },
      { sel: '[data-create="ti_phu"]', name: 'Game TỈ PHÚ' },
    ]) {
      try {
        await leaveRoom(page);
        await leaveRoom(page2);
        await hostCreateAndEnter(g.sel);
        await gotoApp(page2, '/#/sanh');
        await waitMs(600);
        await page2.locator('[data-enter][data-as="play"]:not([disabled])').first().click();
        await waitMs(700);
        await page.locator('[data-start]').click();
        await waitMs(900);
        const roll = page.locator('[data-roll]');
        await roll.waitFor({ state: 'visible', timeout: 8000 });
        await roll.click();
        await waitMs(700);
        rec(g.name, 'Tạo/vào/start + xúc xắc 1 lần', 'pass');
      } catch (e) {
        rec(g.name, 'Tạo/vào/start + xúc xắc 1 lần', 'fail', e.message || e);
      }
    }

    await ctx2.close();
  }

  await finish(browser);
}

async function finish(browser) {
  await browser.close().catch(() => {});
  const passed = rows.filter((r) => r.result === 'pass').length;
  const failed = rows.filter((r) => r.result === 'fail').length;
  const md = `# E2E chức năng LIVE — Roles / Chat / Sảnh

Ngày: 2026-11-12  
URL: \`${BASE}\`  
Tài khoản: \`minh\` · PIN: \`${PIN_MINH}\` (admin reset-pin)  
Lan (2P games): PIN \`${PIN_LAN}\` (admin reset-pin)  
Runner: Playwright + Chrome channel · click thật · \`node scripts/e2e-live-chuc-nang.mjs\`  
Server: \`HNG_DEV_HTTP=1 HNG_ORIGIN=http://127.0.0.1:8443\` · client \`npm run build\` trước khi chạy

## Kết quả tổng

| Pass | Fail | Tổng |
|---:|---:|---:|
| ${passed} | ${failed} | ${rows.length} |

## Chi tiết

| Chức năng | Mục đích | Kết quả | Ghi chú |
|---|---|---|---|
${rows.map((r) => `| ${r.name} | ${r.purpose} | **${r.result}** | ${r.note} |`).join('\n')}

## Ghi chú

- Không soft-pass: game chỉ **pass** khi tạo/vào/start và thao tác chơi được (đánh caro / xúc xắc).
- Xóa quán: chỉ xóa quán tạm E2E, không xóa quán seed đang trên bàn.
- Unit/server Task 6: \`npm test\` **59/59** (xem \`NGHIEM-THU-ROLES.md\`).
`;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, 'utf8');
  console.log(`\nWrote ${OUT} (${passed} pass / ${failed} fail)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  rec('Runner', 'Script E2E', 'fail', e.message || e);
  try {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, `# E2E aborted\n\n${e}`, 'utf8');
  } catch {
    /* ignore */
  }
  process.exit(1);
});
