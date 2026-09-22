/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

// The date-only URL scenarios only fail off UTC, and the threads pool ignores a TZ set inside a spec.
process.env['TZ'] = 'America/Los_Angeles';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/query',
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'query',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests,testing,generators}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    onConsoleLog: (log: string, type: 'stdout' | 'stderr') => {
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
