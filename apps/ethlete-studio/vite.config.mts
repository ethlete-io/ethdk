/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/ethlete-studio',
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'ethlete-studio',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.mjs'],
    reporters: ['default'],
  },
}));
