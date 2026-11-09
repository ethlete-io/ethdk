/// <reference types='vitest' />
import { availableParallelism } from 'node:os';
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/ethlete-studio',
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' }), nxReadySignal()],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'ethlete-studio',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.mjs'],
    // Above 4 workers on a many-core machine the jsdom cases slow down past the half-timeout guard in test-setup.mjs; the cap must not exceed vitest's default (cores - 1) on small CI runners.
    maxWorkers: Math.min(4, Math.max(availableParallelism() - 1, 1)),
    reporters: ['default'],
  },
}));
