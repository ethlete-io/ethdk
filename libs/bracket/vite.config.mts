/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { specWorkers } from '../../tools/vitest/workers.mts';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/bracket',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'bracket',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/bracket',
      provider: 'v8' as const,
    },
  },
}));
