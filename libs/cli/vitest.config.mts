import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cli',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.mts'],
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default', './vitest.skip-reporter.mts'],
    // Workaround: the jiti merge-worker start in sketch/merge.spec.ts, which only that spec does, sets off a V8
    // memory-reducer major GC (15-273 ms) on the server thread and fails its stall check. Docker: 0/10 runs with a
    // no-op merge, 1/5 with the idle worker, 6/15 with the real merge. Per-file execArgv needs nested projects,
    // which vitest.projects.ts cannot load.
    execArgv: ['--no-memory-reducer'],
    coverage: {
      reportsDirectory: '../../coverage/libs/cli',
      provider: 'v8',
    },
  },
});
