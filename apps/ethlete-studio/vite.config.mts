/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/ethlete-studio',
  plugins: [
    // Workaround: analog 2.9.2 fastCompile resolves a `/@fs/<abs>.css?inline` id to itself, so a
    // styleUrl outside the app root fails to load. Remove once its resolveId strips `/@fs`.
    {
      name: 'ethlete-studio:fs-style-inline',
      enforce: 'pre',
      resolveId: (id: string) =>
        id.startsWith('/@fs/') && id.endsWith('?inline') ? id.slice('/@fs'.length) : undefined,
    },
    angular({ tsconfig: 'tsconfig.spec.json', fastCompile: true }),
    nxReadySignal(),
  ],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'ethlete-studio',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', 'src/test-setup.mjs'],
    maxWorkers: specWorkers,
    reporters: ['default'],
  },
}));
