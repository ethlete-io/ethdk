import { defineConfig } from 'vitest/config';

/** On-demand proofs of a rebuild row: red while the row is open, so no CI job runs them. Needs `dist/libs/{components,core}` built. */
export default defineConfig({
  root: import.meta.dirname,
  resolve: { tsconfigPaths: true },
  test: {
    name: 'design-proof',
    environment: 'node',
    globals: true,
    include: ['src/**/*.proof.spec.ts'],
    globalSetup: ['../cli/vitest.global-setup.ts', './vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', '../cli/vitest.setup.ts', './vitest.setup.ts'],
  },
});
