import { configDefaults, defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'cli-core',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: [...configDefaults.exclude],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', '../cli/vitest.setup.ts'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/cli-core',
      provider: 'v8',
    },
  },
});
