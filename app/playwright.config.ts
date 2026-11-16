import { defineConfig } from '@playwright/test';

const port = 8457;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npx tsx scripts/e2e-be-server.ts',
    url: `http://127.0.0.1:${port}/api/roster`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
