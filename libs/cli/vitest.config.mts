import { availableParallelism } from 'node:os';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cli',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.mts'],
    exclude: [...configDefaults.exclude, 'src/**/*.perf.spec.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Each spec worker starts Chromium, Vite servers and git: above 4 at once the design specs time out; the cap must not exceed vitest's default (cores - 1) on small CI runners.
    maxWorkers: Math.min(4, Math.max(availableParallelism() - 1, 1)),
    reporters: ['default', './vitest.skip-reporter.mts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/cli',
      provider: 'v8',
    },
  },
});
