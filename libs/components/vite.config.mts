/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/components',
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'components',
    watch: false,
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['{src,tests,generators}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.mjs'],
    reporters: ['default'],
    onConsoleLog: (log, type) => {
      if (type === 'stderr') {
        // Benign cross-file teardown races: a deferred overlay change-detection
        // tick or an output emission fires after a previous spec's TestBed has
        // been destroyed. Harmless (every spec passes in isolation), but vitest
        // reuses the worker so the stderr lands on — and is mislabelled with —
        // whichever test is running. Filter the two known signatures only.
        if (
          log.includes('NG0406: This instance of the `ApplicationRef` has already been destroyed') ||
          log.includes('NG0953: Unexpected emit for destroyed `OutputRef`')
        ) {
          return false;
        }
      }

      return true;
    },
    coverage: {
      reportsDirectory: '../../coverage/libs/components',
      provider: 'v8' as const,
    },
  },
}));
