import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8457',
    viewport: { width: 1366, height: 768 },
  },
  webServer: {
    command: 'npx tsx scripts/e2e-be-server.ts',
    url: 'http://127.0.0.1:8457/',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      HNG_DEV_HTTP: '1',
      HNG_PORT: '8457',
      HNG_ORIGIN: 'http://127.0.0.1:8457',
      HNG_DB: '/tmp/hng-be-e2e.db',
      HNG_E2E_USER: 'be-e2e',
      HNG_BE_IDLE_VISIBLE_MS: '900000',
      HNG_BE_IDLE_HIDDEN_MS: '300000',
      HNG_BE_IDLE_WARN_MS: '60000',
    },
  },
});
