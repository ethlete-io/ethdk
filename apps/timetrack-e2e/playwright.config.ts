import { defineConfig, devices } from '@playwright/test';

const PORT = 4211;
const BASE_URL = `http://localhost:${PORT}`;

const DIST = process.env['TIMETRACK_E2E_DIST'];

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
    // Pinned so the seeded instant lands on the same calendar day on CI and on a contributor's
    // machine. `support/fixtures.ts` names the day it produces.
    timezoneId: 'UTC',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: DIST
    ? {
        command: `npx vite preview --outDir ${DIST} --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 30_000,
        cwd: '../..',
      }
    : {
        command: 'npx nx serve timetrack-app --configuration=e2e',
        url: BASE_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000,
        cwd: '../..',
      },
});
