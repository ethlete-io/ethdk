import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'cli-perf',
    environment: 'node',
    globals: true,
    include: ['src/**/*.perf.spec.ts'],
    fileParallelism: false,
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', './vitest.setup.ts'],
  },
});
