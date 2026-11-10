import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mts';

export default defineConfig({
  resolve: {
    alias: {
      '@ethlete/timetrack': fileURLToPath(new URL('../../libs/timetrack/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'timetrack-app',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
  },
});
