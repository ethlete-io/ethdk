import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  test: {
    name: 'agent-rules',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', './vitest.setup.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-rules',
      provider: 'v8',
    },
  },
});
