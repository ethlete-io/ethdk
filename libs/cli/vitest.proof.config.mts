import { defineConfig } from 'vitest/config';

/** On-demand proofs of a rebuild row: red while the row is open, so no CI job runs them. Needs `dist/libs/{cli,components,core}` built. */
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'cli-proof',
    environment: 'node',
    globals: true,
    include: ['src/**/*.proof.spec.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', './vitest.setup.ts'],
  },
});
