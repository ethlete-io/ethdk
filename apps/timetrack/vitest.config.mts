import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mts';

export default defineConfig({
  root: import.meta.dirname,
  resolve: { tsconfigPaths: true },
  test: {
    name: 'timetrack-app',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
  },
});
