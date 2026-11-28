import { configDefaults, defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'design',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: [
      ...configDefaults.exclude,
      'src/**/*.perf.spec.ts',
      'src/lib/design/font-proof.spec.ts',
      'src/**/*.proof.spec.ts',
      'src/**/*.dist.spec.ts',
    ],
    globalSetup: ['../cli/vitest.global-setup.ts', './vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', '../cli/vitest.setup.ts', './vitest.setup.ts'],
    maxWorkers: specWorkers,
    reporters: ['default', '../cli/vitest.skip-reporter.mts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/design',
      provider: 'v8',
    },
  },
});
