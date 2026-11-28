import { defineConfig } from 'vitest/config';

/** Specs that draw the committed design parts and need `dist/libs/{components,core}` built first. */
export default defineConfig({
  root: import.meta.dirname,
  resolve: { tsconfigPaths: true },
  test: {
    name: 'design-dist',
    environment: 'node',
    globals: true,
    include: ['src/lib/design/font-proof.spec.ts', 'src/**/*.dist.spec.ts'],
    globalSetup: ['../cli/vitest.global-setup.ts', './vitest.global-setup.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', '../cli/vitest.setup.ts', './vitest.setup.ts'],
  },
});
