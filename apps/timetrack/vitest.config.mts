import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@ethlete/timetrack': fileURLToPath(new URL('../../libs/timetrack/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'timetrack-app',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
});
