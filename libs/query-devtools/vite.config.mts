/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { specWorkers } from '../../tools/vitest/workers.mts';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/query-devtools',
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'query-devtools',
    watch: false,
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.mjs'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/query-devtools',
      provider: 'v8' as const,
    },
  },
}));
