/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/query',
  plugins: [angular(), tsconfigPaths()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ tsconfigPaths() ],
  // },
  test: {
    name: 'query',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests,generators}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    onConsoleLog: (log, type) => {
      if (type === 'stderr') {
        // Suppress HttpErrorResponse logs
        if (log.includes('HttpErrorResponse') || log.includes('Failed to decrypt bearer token')) {
          return false;
        }
      }
      return true;
    },
    coverage: {
      reportsDirectory: '../../coverage/libs/query',
      provider: 'v8' as const,
    },
  },
}));
