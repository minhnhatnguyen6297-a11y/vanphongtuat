import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const state = () =>
  JSON.parse(readFileSync('/tmp/hng-playwright-vuon/pins.json', 'utf8')) as {
    origin: string;
    pins: Record<string, string>;
  };

async function login(page: Page): Promise<void> {
  const { origin, pins } = state();
  await page.goto(`${origin}/#/home`);
  await expect(page.getByRole('heading', { name: 'ĐĂNG NHẬP' })).toBeVisible();
  await page.getByRole('button', { name: 'Minh (Bạn)' }).click();
  await page.locator('#login-pin').fill(pins.minh!);
  await page.getByRole('button', { name: 'VÀO SẢNH' }).click();
  await expect(page.getByText(/CHÀO MINH/)).toBeVisible();
}

test('vào vườn, cho ăn và tưới, thấy kết quả', async ({ page }) => {
  const { origin } = state();
  await login(page);
  await page.goto(`${origin}/#/sanh`);
  await page.locator('a.hn-vuon-tile').click();
  await expect(page).toHaveURL(/#\/vuon$/);
  await expect(page.locator('[data-vuon-root]')).toBeVisible();
  await expect(page.locator('[data-vuon-level]')).toContainText('Non');

  await page.getByRole('button', { name: 'Cho ăn' }).click();
  await expect(page.locator('[data-vuon-status]')).toContainText('Đã cho ăn');
  await expect(page.locator('[data-vuon-root]')).toHaveAttribute('data-expression', 'man_nguyen');
  await expect(page.locator('[data-vuon-mood-label]')).toHaveText('Mãn nguyện');
  await expect(page.locator('[data-vuon-days]')).toHaveText('1 ngày chăm');

  await page.getByRole('button', { name: 'Cho ăn' }).click();
  await expect(page.locator('[data-vuon-status]')).toContainText('Hôm nay đã no rồi');
  await expect(page.locator('[data-vuon-days]')).toHaveText('1 ngày chăm');

  await page.getByRole('button', { name: 'Tưới cây' }).click();
  await expect(page.locator('[data-vuon-status]')).toContainText('Đã tưới');
  await expect(page.locator('[data-vuon-name]')).toHaveText('Chồi sen');
  await expect(page.locator('[data-vuon-days]')).toHaveText('1 ngày chăm');
  await expect(page.locator('[data-vuon-root]')).toBeVisible();

  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Xuân' }).click();
  await page.screenshot({ path: '/opt/cursor/artifacts/vuon-desktop-vuon.png' });
  await page.getByRole('button', { name: 'Kho thú cưng' }).click();
  await expect(page.locator('[data-vuon-wood-title]')).toHaveText('Kho thú cưng');
  await page.locator('[data-stage-pick="than_thoai"]').click();
  await expect(page.locator('[data-vuon-preview]')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/vuon-desktop-kho.png' });
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.locator('[data-vuon-root]')).toHaveClass(/has-giant/);
  await page.screenshot({ path: '/opt/cursor/artifacts/vuon-desktop-than.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/opt/cursor/artifacts/vuon-mobile-than.png' });
  await page.getByRole('button', { name: 'Kho cây trồng' }).click();
  await page.locator('[data-stage-pick="than_thoai"]').click();
  await page.screenshot({ path: '/opt/cursor/artifacts/vuon-mobile-kho.png' });
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await page.screenshot({ path: '/opt/cursor/artifacts/vuon-mobile-vuon.png' });
});
