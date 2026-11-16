import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

test('đăng nhập, vẽ cá, thả vào bể, nhắn chat', async ({ page }) => {
  const pin = readFileSync(join(process.cwd(), 'data/e2e-be-pin.txt'), 'utf8').trim();
  await page.goto('/');
  await page.locator('[data-user="minh"]').click();
  await page.locator('#login-pin').fill(pin);
  await page.locator('#login-go').click();
  await expect(page.locator('.hn-floor')).toBeVisible();

  await page.goto('/#/chat');
  await expect(page.locator('[data-be-canvas]')).toBeVisible();
  await expect(page.locator('[data-be-fish-count]')).toHaveAttribute('data-be-fish-count', '0');

  await page.locator('[data-be-add]').click();
  await page.locator('[data-kind="ca"]').click();
  const pad = page.locator('[data-pad-canvas]');
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) throw new Error('giấy vẽ');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.35, { steps: 10 });
  await page.mouse.up();

  await page.locator('[data-pad-next]').click();
  await page.locator('[data-pad-next]').click();
  await expect(page.locator('[data-pad-next]')).toHaveText('Thả vào bể');
  await page.locator('[data-pad-next]').click();

  await expect(page.locator('[data-be-fish-count]')).toHaveAttribute('data-be-fish-count', '1');
  await expect(page.locator('[data-be-pad]')).toBeHidden();

  await page.locator('[data-chat-input]').fill('cá mới bơi rồi');
  await page.locator('[data-chat-send]').click();
  await expect(page.locator('[data-chat-log]')).toContainText('cá mới bơi rồi');
  await expect(page.locator('[data-be-canvas]')).toBeVisible();
});
