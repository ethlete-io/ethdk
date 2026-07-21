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
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.mjs'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/components',
      provider: 'v8' as const,
    },
  },
}));
