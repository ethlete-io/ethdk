import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'timetrack',
    environment: 'node',
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs'],
    globals: true,
    include: ['src/**/*.spec.ts', 'testing/**/*.spec.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/timetrack',
      provider: 'v8',
    },
  },
});
