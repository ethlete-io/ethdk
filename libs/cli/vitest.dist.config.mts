import { defineConfig } from 'vitest/config';

/** Specs that draw the committed design parts and need `dist/libs/{cli,components,core}` built first. */
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'cli-dist',
    environment: 'node',
    globals: true,
    include: ['src/lib/design/font-proof.spec.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', './vitest.setup.ts'],
  },
});
