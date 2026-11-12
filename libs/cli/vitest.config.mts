import { configDefaults, defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  test: {
    name: 'cli',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.mts'],
    exclude: [...configDefaults.exclude, 'src/**/*.perf.spec.ts', 'src/lib/design/font-proof.spec.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', './vitest.setup.ts'],
    maxWorkers: specWorkers,
    reporters: ['default', './vitest.skip-reporter.mts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/cli',
      provider: 'v8',
    },
  },
});
