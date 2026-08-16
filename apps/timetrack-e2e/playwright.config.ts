import { defineConfig, devices } from '@playwright/test';

const PORT = 4211;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Drives the app against `main.e2e.ts`, which swaps the desktop host for in-memory fakes. There is no
 * Tauri, no network and no keychain in this run — every answer comes from `src/e2e/world.ts`.
 */
export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'dot' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx nx serve timetrack-app --configuration=e2e',
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    cwd: '../..',
  },
});
