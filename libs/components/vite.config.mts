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
    onConsoleLog: (log: string, type: 'stdout' | 'stderr') => {
      // every spec that bootstraps an ApplicationRef prints it, and a spec run is always dev mode
      if (log.includes('Angular is running in development mode')) {
        return false;
      }

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

        // `RuntimeError` logs its `data` payload from a `setTimeout`, so the bare object arrives
        // detached from the error it belongs to and is attributed to whichever test is running by
        // then. Match the payload dump alone - an `ERROR RuntimeError: ET…` print still comes
        // through, so an unexpected error is never silent.
        if (log.trimStart().startsWith('{') && log.includes('__ngContext__')) {
          return false;
        }

        // jsdom's CSS parser drops the component stylesheets whole (`@layer`,
        // nesting, `color-mix`), so every component host keeps the UA default
        // `display: inline` and signalElementDimensions' dev-mode warning fires
        // for hosts that are `display: grid` in a browser.
        if (log.includes('Inline elements cannot be observed for dimensions')) {
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
