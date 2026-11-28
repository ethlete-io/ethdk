import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  resolve: { tsconfigPaths: true },
  test: {
    name: 'design-perf',
    environment: 'node',
    globals: true,
    include: ['src/**/*.perf.spec.ts'],
    fileParallelism: false,
    globalSetup: ['../cli/vitest.global-setup.ts', './vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', '../cli/vitest.setup.ts', './vitest.setup.ts'],
  },
});
