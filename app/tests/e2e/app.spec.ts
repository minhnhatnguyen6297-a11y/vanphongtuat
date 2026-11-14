import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const state = () =>
  JSON.parse(readFileSync('/tmp/hng-playwright-e2e/pins.json', 'utf8')) as {
    origin: string;
    pins: Record<string, string>;
  };

async function login(page: Page, who: 'minh' | 'lan', label: string): Promise<void> {
  const { origin, pins } = state();
  await page.goto(`${origin}/#/home`);
  await expect(page.getByRole('heading', { name: 'ĐĂNG NHẬP' })).toBeVisible();
  await page.getByRole('button', { name: label }).click();
  await page.locator('#login-pin').fill(pins[who]);
  await page.getByRole('button', { name: 'VÀO SẢNH' }).click();
  await expect(page.getByRole('link', { name: 'Văn phòng Tuất, Hôm nay ăn gì?' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('đăng nhập đúng tên thì vào sảnh', async ({ page }) => {
  await login(page, 'minh', 'Minh (Bạn)');
  await page.goto(`${state().origin}/#/home`);
  await expect(page.getByText('CHÀO MINH!')).toBeVisible();
});

test('PIN sai thì không vào', async ({ page }) => {
  const { origin } = state();
  await page.goto(`${origin}/#/home`);
  await page.getByRole('button', { name: 'Minh (Bạn)' }).click();
  await page.locator('#login-pin').fill('000000');
  await page.getByRole('button', { name: 'VÀO SẢNH' }).click();
  await expect(page.getByText('Sai PIN rồi')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ĐĂNG NHẬP' })).toBeVisible();
});

test('hai người vote thì phần trăm đổi không cần tải lại', async ({ browser }) => {
  const { origin } = state();
  const minh = await browser.newPage();
  const lan = await browser.newPage();
  await login(minh, 'minh', 'Minh (Bạn)');
  await login(lan, 'lan', 'Lan HR');
  await minh.goto(`${origin}/#/ban`);
  await lan.goto(`${origin}/#/ban`);
  const shop = minh.locator('button[data-vote]').first();
  await expect(shop).toBeVisible();
  const id = await shop.getAttribute('data-vote');
  const before = await minh.locator(`button[data-vote="${id}"] .hn-shop-progress b`).innerText();
  await lan.locator(`button[data-vote="${id}"]`).click();
  await expect(minh.locator(`button[data-vote="${id}"] .hn-shop-progress b`)).not.toHaveText(before);
  await minh.close();
  await lan.close();
});

test('chủ xị chốt quán thì tem CHỐT hiện và thực đơn đổi', async ({ page }) => {
  const { origin } = state();
  await login(page, 'minh', 'Minh (Bạn)');
  await page.goto(`${origin}/#/ban`);
  const before = (await page.locator('.hn-calling-shop').innerText()).trim();
  const cards = await page.locator('button[data-vote]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-vote') || '',
      name: el.querySelector('b')?.textContent?.trim() || '',
    })),
  );
  const other = cards.find((c) => !c.name.toUpperCase().includes(before.toUpperCase())) || cards[cards.length - 1];
  await page.locator(`button[data-lock="${other.id}"]`).click();
  await expect(page.locator('.hn-badge-locked')).toBeVisible();
  await expect(page.locator('.hn-calling-shop')).not.toHaveText(before);
});

test('gọi món thì dòng món mang tên người gọi', async ({ page }) => {
  const { origin } = state();
  await login(page, 'minh', 'Minh (Bạn)');
  await page.goto(`${origin}/#/ban`);
  const chip = page.locator('button[data-menu]').first();
  const dish = (await chip.innerText()).split('\n')[0].trim();
  await chip.click();
  await page.getByRole('button', { name: 'GỌI', exact: true }).click();
  await expect(page.locator('.hn-order-row').filter({ hasText: dish.slice(0, 12) })).toBeVisible();
});

test('chia đều, bill là 10.000đ nhân số người, thì mỗi người 10.000đ', async ({ page }) => {
  const { origin } = state();
  await login(page, 'minh', 'Minh (Bạn)');
  await page.goto(`${origin}/#/tien`);
  const n = await page.locator('.hn-person-row').count();
  expect(n).toBeGreaterThanOrEqual(2);
  const bill = n * 10000;
  await page.locator('#bill-total').fill(String(bill));
  await page.locator('#bill-total').press('Enter');
  await page.locator('[data-mode="equal"]').click();
  await expect(page.locator('[data-mode="equal"]')).toHaveAttribute('aria-pressed', 'true');
  const shares = await page.locator('.hn-person-row').evaluateAll((rows) =>
    rows.map((row) => {
      const m = (row as HTMLElement).innerText.match(/(\d{1,3}(?:\.\d{3})+)đ/);
      return m ? Number(m[1].replace(/\./g, '')) : 0;
    }),
  );
  expect(shares).toEqual(Array.from({ length: n }, () => 10000));
  expect(shares.reduce((s, x) => s + x, 0)).toBe(bill);
});

test('QA-02 dân đen không có cách kết thúc vote', async ({ page }) => {
  test.fail(true, 'QA-02');
  const { origin } = state();
  await login(page, 'lan', 'Lan HR');
  await page.goto(`${origin}/#/ban`);
  const endings = await page.getByRole('button', { name: /Chốt|Đóng vote|Kết thúc/ }).count();
  expect(endings).toBeGreaterThan(0);
});

test('QA-01 đếm ngược 8 giây thì vote tự khóa', async ({ page }) => {
  test.fail(true, 'QA-01');
  const { origin } = state();
  await login(page, 'minh', 'Minh (Bạn)');
  await page.goto(`${origin}/#/ban`);
  const before = await page.getByText(/#\d+/).first().innerText();
  await page.getByRole('button', { name: /KÊ BÀN MỚI/ }).click();
  await page.locator('#ct-vote-sec').fill('8');
  await page.locator('#ct-go').click();
  await expect(page.locator('#ct-go')).toBeHidden();
  await expect(page.getByText(/#\d+/).first()).not.toHaveText(before);
  await page.waitForTimeout(9000);
  await expect(page.locator('.hn-badge-locked')).toBeVisible();
});

async function ensureSpin(page: Page): Promise<void> {
  const { origin } = state();
  await page.goto(`${origin}/#/quay`);
  const shopWheel = page.getByRole('button', { name: 'Trưa nay ăn gì?' }).first();
  if (await shopWheel.count()) await shopWheel.click();
  if ((await page.locator('#wheel-face').count()) === 0) {
    await page.getByRole('button', { name: '+ VÒNG MỚI' }).click();
    await expect(page.locator('#wheel-face')).toBeVisible();
  }
  for (const name of ['Ô Một', 'Ô Hai']) {
    if (await page.locator('[data-act="spin"]').isEnabled()) break;
    const rows = page.locator('.hn-wheel-row');
    const before = await rows.count();
    await page.locator('#wheel-new').fill(name);
    await page.getByRole('button', { name: 'THÊM', exact: true }).click();
    await expect(rows).toHaveCount(before + 1);
  }
  await expect(page.locator('[data-act="spin"]')).toBeEnabled();
}

test('vòng quay dừng thì tên khớp ô dưới kim và không hiện thẻ sớm', async ({ page }) => {
  await login(page, 'minh', 'Minh (Bạn)');
  await ensureSpin(page);
  await page.locator('[data-act="spin"]').click();
  await expect(page.getByRole('button', { name: /ĐANG QUAY/ })).toBeVisible();
  await expect(page.locator('.hn-wheel-winner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /QUAY LẠI/ })).toBeVisible({ timeout: 8000 });
  const match = await page.evaluate(() => {
    const face = document.querySelector('#wheel-face');
    if (!face) return { winner: '', closest: '' };
    const rect = face.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + 14;
    const labels = Array.from(document.querySelectorAll('.hn-wheel-label'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: (el.getAttribute('title') || el.textContent || '').trim(),
          d: Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y),
        };
      })
      .sort((a, b) => a.d - b.d);
    return {
      winner: document.querySelector('.hn-wheel-winner')?.textContent?.trim() || '',
      closest: labels[0]?.name || '',
    };
  });
  expect(match.winner).toBe(match.closest);
  expect(match.winner.length).toBeGreaterThan(0);
});

test('QA-03 nhật ký không được ghi tên khi đĩa còn quay', async ({ page }) => {
  test.fail(true, 'QA-03');
  await login(page, 'minh', 'Minh (Bạn)');
  await ensureSpin(page);
  const before = await page.locator('.hn-wheel-log-row').count();
  await page.locator('[data-act="spin"]').click();
  await expect(page.getByRole('button', { name: /ĐANG QUAY/ })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await page.locator('.hn-wheel-log-row').count()).toBe(before);
});
