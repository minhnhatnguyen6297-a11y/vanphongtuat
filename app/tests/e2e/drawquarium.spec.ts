import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('đăng nhập, vẽ cá, thả vào bể, nhắn chat', async ({ page }) => {
  const pin = readFileSync('/tmp/hng-be-e2e-pin', 'utf8').trim();
  await page.goto('/');
  await page.getByRole('button', { name: 'Bống thử' }).click();
  await page.locator('#login-pin').fill(pin);
  await page.getByRole('button', { name: 'VÀO SẢNH' }).click();
  await expect(page.locator('.hn-floor')).toBeVisible();

  await page.goto('/#/chat');
  await expect(page.locator('[data-be-canvas]')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByRole('button', { name: 'Cá', exact: true }).click();
  const pad = page.locator('[data-be-pad]');
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) throw new Error('không thấy giấy vẽ');
  await page.mouse.move(box.x + 30, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.45, { steps: 14 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('button', { name: 'Thả vào bể' }).click();

  await expect(page.locator('[data-be-count]')).toContainText(/Cá [1-9]/);
  await expect(page.locator('[data-be-fish-name]').first()).toBeVisible();
  await expect(page.locator('[data-be-canvas][data-be-ready="1"]')).toBeVisible();

  await page.locator('[data-chat-input]').fill('trưa ăn phở nhé');
  await page.locator('[data-chat-send]').click();
  await expect(page.locator('.hn-chat-body').last()).toContainText('trưa ăn phở nhé');
  await expect(page.locator('[data-be-count]')).toContainText(/Cá [1-9]/);
});
