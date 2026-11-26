import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/storybook-vitest',
  resolve: { tsconfigPaths: true },
  plugins: [storybookTest({ configDir: `${__dirname}/.storybook` })],
  test: {
    name: 'storybook',
    setupFiles: ['.storybook/vitest.setup.ts'],
    // Workaround: with an iframe per file, Chromium closes the orchestrator page's websockets
    // (code 1001) after about 10-30 files, so a runner with few workers fails the run with
    // VITEST_BROWSER_CONNECTION_CLOSED. Seen with vitest 5.0.5 and @analogjs/vite-plugin-angular 2.9.2.
    isolate: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
}));
