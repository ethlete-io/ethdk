import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mts';

export default defineConfig({
  test: {
    name: 'eslint-plugin',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.js'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/eslint-plugin',
      provider: 'v8',
    },
  },
});
