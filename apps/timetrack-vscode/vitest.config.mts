import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  // The lib is consumed from source rather than from `dist`: it is a workspace package whose only
  // built entry comes from `nx build timetrack`, and a test run must not depend on that having run.
  resolve: {
    alias: {
      '@ethlete/timetrack': fileURLToPath(new URL('../../libs/timetrack/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'timetrack-vscode',
    environment: 'node',
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs'],
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/apps/timetrack-vscode',
      provider: 'v8',
    },
  },
});
