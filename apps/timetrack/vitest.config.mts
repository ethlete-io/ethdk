import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  root: import.meta.dirname,
  resolve: { tsconfigPaths: true },
  test: {
    name: 'timetrack-app',
    environment: 'node',
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs'],
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
  },
});
