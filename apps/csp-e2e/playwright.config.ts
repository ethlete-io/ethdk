import { defineConfig, devices } from '@playwright/test';

const PORT = 4431;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'dot' : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry', locale: 'en-US' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node apps/csp-e2e/serve-csp.mjs dist/apps/csp/browser ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
    cwd: '../..',
  },
});
