import { defineConfig, devices } from '@playwright/test';

const url = process.env['STORYBOOK_URL'];
const PORT = 4401;
const BASE_URL = url ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'dot' : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'touch', use: { ...devices['Pixel 7'] } },
  ],
  webServer: url
    ? undefined
    : {
        command: `node apps/storybook-e2e/serve-static.mjs dist/storybook ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
        cwd: '../..',
      },
});
