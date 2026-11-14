import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    channel: 'chrome',
    viewport: { width: 1366, height: 768 },
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    reducedMotion: 'no-preference',
  },
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
});
